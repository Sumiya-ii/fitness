import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated as RNAnimated,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BackButton, Button, Card, Badge } from '../../components/ui';
import { api } from '../../api';
import { mealsApi } from '../../api/meals';
import { trackEvent, EVENTS } from '../../utils/analytics';
import { useLocale } from '../../i18n';
import { useColors } from '../../theme';
import type { LogStackScreenProps } from '../../navigation/types';

type Props = LogStackScreenProps<'VoiceLog'>;

interface ParsedFoodItem {
  name: string;
  quantity: number;
  unit: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: number;
}

interface VoiceDraft {
  id: string;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  transcription?: string;
  mealType?: string | null;
  items?: ParsedFoodItem[];
  totalCalories?: number;
  totalProtein?: number;
  totalCarbs?: number;
  totalFat?: number;
}

type ScreenState =
  | 'idle'
  | 'recording'
  | 'uploading'
  | 'processing'
  | 'results'
  | 'saving'
  | 'success';
type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  breakfast: 'sunny-outline',
  lunch: 'restaurant-outline',
  dinner: 'moon-outline',
  snack: 'cafe-outline',
};
const POLL_INTERVAL_FAST_MS = 2000;
const POLL_INTERVAL_SLOW_MS = 4000;
const POLL_FAST_THRESHOLD = 15;
const MAX_POLL_ATTEMPTS = 60;
const MAX_RECORDING_SECONDS = 60;
const WARN_RECORDING_SECONDS = 45;

function autoDetectMealType(): MealType {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 15) return 'lunch';
  if (hour >= 15 && hour < 18) return 'snack';
  if (hour >= 18 && hour < 22) return 'dinner';
  return 'snack';
}

function getProcessingMessage(
  screenState: ScreenState,
  draftWorkerStatus: 'waiting' | 'active' | null,
  t: (key: string) => string,
): string {
  if (screenState === 'uploading') return t('voiceLog.uploading');
  if (draftWorkerStatus === 'active') return t('voiceLog.analyzingNutrition');
  return t('voiceLog.transcribing');
}

// -- Edit Item Modal --

interface EditItemModalProps {
  item: ParsedFoodItem;
  onSave: (updated: ParsedFoodItem) => void;
  onClose: () => void;
  t: (key: string) => string;
  c: ReturnType<typeof useColors>;
}

function EditItemModal({ item, onSave, onClose, t, c }: EditItemModalProps) {
  const [name, setName] = useState(item.name);
  const [calories, setCalories] = useState(String(Math.round(item.calories)));
  const [protein, setProtein] = useState(String(item.protein));
  const [carbs, setCarbs] = useState(String(item.carbs));
  const [fat, setFat] = useState(String(item.fat));

  const handleSave = () => {
    const cal = parseFloat(calories);
    if (isNaN(cal) || cal < 0) {
      Alert.alert(t('voiceLog.invalid'), t('voiceLog.invalidCalories'));
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSave({
      ...item,
      name: name.trim() || item.name,
      calories: Math.round(cal),
      protein: parseFloat(protein) || 0,
      carbs: parseFloat(carbs) || 0,
      fat: parseFloat(fat) || 0,
      confidence: 1.0,
    });
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <Pressable
          className="flex-1 bg-black/40"
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <View className="bg-surface-card rounded-t-3xl px-5 pt-5 pb-8">
          <View className="flex-row items-center justify-between mb-5">
            <Text className="text-text font-sans-semibold text-lg">
              {t('voiceLog.editFoodItem')}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              className="h-9 w-9 items-center justify-center rounded-full bg-surface-secondary"
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Ionicons name="close" size={18} color={c.textSecondary} />
            </Pressable>
          </View>

          <Text className="text-xs text-text-tertiary font-sans-medium mb-1 uppercase tracking-wider">
            {t('voiceLog.name')}
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            className="bg-surface-secondary rounded-2xl px-4 py-3 text-base font-sans-medium text-text mb-4"
            placeholderTextColor={c.textTertiary}
          />

          <View className="flex-row gap-3 mb-5">
            {(
              [
                { label: t('voiceLog.calories'), value: calories, set: setCalories },
                { label: t('voiceLog.proteinG'), value: protein, set: setProtein },
                { label: t('voiceLog.carbsG'), value: carbs, set: setCarbs },
                { label: t('voiceLog.fatG'), value: fat, set: setFat },
              ] as const
            ).map(({ label, value, set }) => (
              <View key={label} className="flex-1">
                <Text className="text-xs text-text-tertiary font-sans-medium mb-1">{label}</Text>
                <TextInput
                  value={value}
                  onChangeText={set as (v: string) => void}
                  keyboardType="decimal-pad"
                  className="bg-surface-secondary rounded-xl px-2 py-3 text-base font-sans-medium text-text text-center"
                  placeholderTextColor={c.textTertiary}
                />
              </View>
            ))}
          </View>

          <Button onPress={handleSave} accessibilityLabel={t('common.save')}>
            {t('common.save')}
          </Button>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// -- Main Screen --

export function VoiceLogScreen() {
  const navigation = useNavigation<Props['navigation']>();
  const { locale, t } = useLocale();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const [screenState, setScreenState] = useState<ScreenState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [draftItems, setDraftItems] = useState<ParsedFoodItem[]>([]);
  const [transcription, setTranscription] = useState('');
  const [mealType, setMealType] = useState<MealType>(autoDetectMealType);
  const [draftWorkerStatus, setDraftWorkerStatus] = useState<'waiting' | 'active' | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseAnim = useRef(new RNAnimated.Value(1)).current;
  const pulseLoop = useRef<RNAnimated.CompositeAnimation | null>(null);
  const successScale = useRef(new RNAnimated.Value(0)).current;
  const successOpacity = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  // Pulse animation when recording
  useEffect(() => {
    if (screenState === 'recording') {
      pulseLoop.current = RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(pulseAnim, { toValue: 1.18, duration: 650, useNativeDriver: true }),
          RNAnimated.timing(pulseAnim, { toValue: 1, duration: 650, useNativeDriver: true }),
        ]),
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
    }
  }, [screenState, pulseAnim]);

  const formatElapsed = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const startRecording = async () => {
    setError(null);
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      Alert.alert(t('common.permissionNeeded'), t('voiceLog.micRequired'));
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setScreenState('recording');
    setElapsed(0);
    timerRef.current = setInterval(() => {
      setElapsed((e) => {
        const next = e + 1;
        if (next >= MAX_RECORDING_SECONDS) {
          stopRecording();
        }
        return next;
      });
    }, 1000);
  };

  const stopRecording = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await recorder.stop();
    const uri = recorder.uri;
    if (!uri) {
      setError(t('voiceLog.recordingFailed'));
      setScreenState('idle');
      return;
    }
    await uploadAudio(uri);
  };

  const uploadAudio = async (uri: string) => {
    setScreenState('uploading');
    setDraftWorkerStatus(null);
    try {
      const formData = new FormData();
      formData.append('audio', {
        uri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      } as unknown as Blob);
      formData.append('locale', locale);
      const res = await api.upload<{ data: { draftId: string } }>('/voice/upload', formData);
      setScreenState('processing');
      pollDraft(res.data.draftId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
      setScreenState('idle');
    }
  };

  const pollDraft = async (draftId: string, attempt = 0) => {
    if (attempt >= MAX_POLL_ATTEMPTS) {
      setError(t('voiceLog.processingTimeout'));
      setScreenState('idle');
      return;
    }
    try {
      const res = await api.get<{ data: VoiceDraft }>(`/voice/drafts/${draftId}`);
      const d = res.data;

      if (d.status === 'active') setDraftWorkerStatus('active');
      else if (d.status === 'waiting') setDraftWorkerStatus('waiting');

      if (d.status === 'completed') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const items = d.items ?? [];
        setTranscription(d.transcription ?? '');
        setDraftItems(items);
        if (d.mealType && MEAL_TYPES.includes(d.mealType as MealType)) {
          setMealType(d.mealType as MealType);
        }
        setScreenState('results');
        trackEvent(EVENTS.VOICE_LOG_PROCESSED, {
          itemCount: items.length,
          totalCalories: d.totalCalories ?? 0,
          hasLowConfidenceItems: items.some((it) => it.confidence < 0.7),
          locale,
        });
        return;
      }

      if (d.status === 'failed') {
        setError(t('voiceLog.processingFailed'));
        setScreenState('idle');
        return;
      }

      const delay = attempt < POLL_FAST_THRESHOLD ? POLL_INTERVAL_FAST_MS : POLL_INTERVAL_SLOW_MS;
      pollTimerRef.current = setTimeout(() => pollDraft(draftId, attempt + 1), delay);
    } catch {
      setError(t('voiceLog.statusCheckFailed'));
      setScreenState('idle');
    }
  };

  const handleDeleteItem = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDraftItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEditSave = (index: number, updated: ParsedFoodItem) => {
    setDraftItems((prev) => prev.map((item, i) => (i === index ? updated : item)));
    setEditingIndex(null);
  };

  const handleSave = async () => {
    if (draftItems.length === 0) return;
    setScreenState('saving');
    setError(null);
    try {
      const totalCalories = draftItems.reduce((s, i) => s + i.calories, 0);
      const totalProtein = draftItems.reduce((s, i) => s + i.protein, 0);
      const totalCarbs = draftItems.reduce((s, i) => s + i.carbs, 0);
      const totalFat = draftItems.reduce((s, i) => s + i.fat, 0);
      const note = `Voice: ${draftItems.map((i) => i.name).join(', ')}`;

      await mealsApi.quickAdd({
        mealType,
        calories: Math.round(totalCalories),
        proteinGrams: Math.round(totalProtein * 10) / 10,
        carbsGrams: Math.round(totalCarbs * 10) / 10,
        fatGrams: Math.round(totalFat * 10) / 10,
        note,
        source: 'voice',
      });

      trackEvent(EVENTS.MEAL_LOG_SAVED, {
        source: 'voice',
        mealType,
        calories: Math.round(totalCalories),
        itemCount: draftItems.length,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setScreenState('success');
      successScale.setValue(0);
      successOpacity.setValue(1);
      RNAnimated.sequence([
        RNAnimated.spring(successScale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 120,
          friction: 8,
        }),
        RNAnimated.delay(700),
        RNAnimated.timing(successOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => navigation.goBack());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
      setScreenState('results');
    }
  };

  const handleReset = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setScreenState('idle');
    setDraftItems([]);
    setTranscription('');
    setMealType(autoDetectMealType());
    setError(null);
    setElapsed(0);
    setDraftWorkerStatus(null);
  };

  const handleMealTypeSelect = (type: MealType) => {
    Haptics.selectionAsync();
    setMealType(type);
  };

  const timerColor = elapsed >= WARN_RECORDING_SECONDS ? 'text-warning' : 'text-text';
  const totalCalories = Math.round(draftItems.reduce((s, i) => s + i.calories, 0));
  const totalProtein = Math.round(draftItems.reduce((s, i) => s + i.protein, 0));
  const totalCarbs = Math.round(draftItems.reduce((s, i) => s + i.carbs, 0));
  const totalFat = Math.round(draftItems.reduce((s, i) => s + i.fat, 0));

  const processingStepIndex =
    screenState === 'uploading' ? 0 : draftWorkerStatus === 'active' ? 2 : 1;

  return (
    <View className="flex-1 bg-surface-app">
      <SafeAreaView edges={['top']} className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-5 py-3">
          <BackButton />
          <Text className="ml-3 text-lg font-sans-semibold text-text">{t('voiceLog.title')}</Text>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: Math.max(insets.bottom, 24),
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* -- IDLE -- */}
          {screenState === 'idle' && (
            <Animated.View
              entering={FadeInDown.duration(400)}
              className="flex-1 items-center justify-center px-8 py-16"
            >
              <Text className="text-text-secondary text-center mb-10 text-base leading-6">
                {t('voiceLog.instruction')}
              </Text>
              <Pressable
                onPress={startRecording}
                accessibilityRole="button"
                accessibilityLabel={t('voiceLog.tapToStart')}
                className="h-28 w-28 rounded-full bg-primary-500 items-center justify-center"
              >
                <Ionicons name="mic" size={52} color={c.onPrimary} />
              </Pressable>
              <Text className="mt-5 text-text-tertiary text-sm font-sans-medium">
                {t('voiceLog.tapToStart')}
              </Text>
              {error ? (
                <View className="mt-6 rounded-2xl bg-danger/10 px-4 py-3">
                  <Text className="text-center text-danger text-sm font-sans-medium">{error}</Text>
                </View>
              ) : null}
            </Animated.View>
          )}

          {/* -- RECORDING -- */}
          {screenState === 'recording' && (
            <View className="flex-1 items-center justify-center px-8 py-16">
              <Text className="text-text-secondary text-center mb-6 text-base">
                {t('voiceLog.listening')}
              </Text>
              <Text className={`font-sans-bold text-5xl mb-1 tabular-nums ${timerColor}`}>
                {formatElapsed(elapsed)}
              </Text>
              <Text className="text-xs text-text-tertiary mb-10">
                / {formatElapsed(MAX_RECORDING_SECONDS)} {t('voiceLog.max')}
              </Text>
              <RNAnimated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <Pressable
                  onPress={stopRecording}
                  accessibilityRole="button"
                  accessibilityLabel={t('voiceLog.tapToStop')}
                  className="h-28 w-28 rounded-full bg-danger items-center justify-center"
                >
                  <Ionicons name="stop" size={46} color="#ffffff" />
                </Pressable>
              </RNAnimated.View>
              <Text className="mt-5 text-text-tertiary text-sm font-sans-medium">
                {t('voiceLog.tapToStop')}
              </Text>
            </View>
          )}

          {/* -- UPLOADING / PROCESSING -- */}
          {(screenState === 'uploading' || screenState === 'processing') && (
            <View className="flex-1 items-center justify-center px-8 py-16">
              <ActivityIndicator size="large" color={c.primary} />
              <Text className="mt-5 text-text text-base font-sans-medium">
                {getProcessingMessage(screenState, draftWorkerStatus, t)}
              </Text>
              {/* Step progress */}
              <View className="flex-row gap-2 mt-5">
                {[0, 1, 2].map((i) => (
                  <View
                    key={i}
                    className={`h-2 rounded-full ${
                      i <= processingStepIndex ? 'bg-primary-500 w-8' : 'bg-surface-border w-2'
                    }`}
                  />
                ))}
              </View>
              <View className="flex-row gap-2 mt-3">
                {[
                  { key: 'uploadStep', idx: 0 },
                  { key: 'transcribeStep', idx: 1 },
                  { key: 'analyzeStep', idx: 2 },
                ].map(({ key, idx }) => (
                  <Text
                    key={key}
                    className={`text-xs font-sans-medium ${
                      idx <= processingStepIndex ? 'text-text' : 'text-text-tertiary'
                    }`}
                  >
                    {t(`voiceLog.${key}`)}
                    {idx < processingStepIndex ? ' \u2713' : ''}
                  </Text>
                ))}
              </View>
            </View>
          )}

          {/* -- RESULTS / SAVING -- */}
          {(screenState === 'results' || screenState === 'saving') && (
            <View className="px-5 py-4">
              {/* Transcription */}
              {transcription.length > 0 && (
                <Animated.View entering={FadeInDown.duration(300).delay(50)}>
                  <Card className="mb-4">
                    <Text className="text-xs font-sans-semibold text-text-tertiary uppercase tracking-wider mb-2">
                      {t('voiceLog.whatYouSaid')}
                    </Text>
                    <Text className="text-text text-sm leading-5 italic">
                      &ldquo;{transcription}&rdquo;
                    </Text>
                  </Card>
                </Animated.View>
              )}

              {/* Meal type chips */}
              <Animated.View entering={FadeInDown.duration(300).delay(100)}>
                <Text className="text-xs font-sans-semibold text-text-tertiary uppercase tracking-wider mb-2">
                  {t('voiceLog.mealType')}
                </Text>
                <View className="flex-row gap-2 mb-5">
                  {MEAL_TYPES.map((type) => {
                    const isSelected = mealType === type;
                    return (
                      <Pressable
                        key={type}
                        onPress={() => handleMealTypeSelect(type)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        accessibilityLabel={t(`mealTypes.${type}`)}
                        className={`flex-1 items-center rounded-2xl py-2.5 ${
                          isSelected ? 'bg-primary-500' : 'bg-surface-card'
                        }`}
                      >
                        <Ionicons
                          name={MEAL_ICONS[type]}
                          size={16}
                          color={isSelected ? c.onPrimary : c.textTertiary}
                        />
                        <Text
                          className={`font-sans-medium text-xs mt-0.5 ${
                            isSelected ? 'text-on-primary' : 'text-text-tertiary'
                          }`}
                        >
                          {t(`mealTypes.${type}`)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Animated.View>

              {/* Food items */}
              {draftItems.length > 0 && (
                <>
                  <Animated.View entering={FadeInDown.duration(300).delay(150)}>
                    <Text className="text-xs font-sans-semibold text-text-tertiary uppercase tracking-wider mb-3">
                      {t('voiceLog.identifiedFoods')}
                    </Text>
                  </Animated.View>
                  {draftItems.map((item, index) => {
                    const isLowConfidence = item.confidence < 0.7;
                    const portionLabel =
                      item.grams > 0
                        ? `${item.quantity} ${item.unit} · ~${item.grams}g`
                        : `${item.quantity} ${item.unit}`;
                    return (
                      <Animated.View
                        key={`${item.name}-${index}`}
                        entering={FadeInDown.duration(250).delay(Math.min(index * 40, 200) + 200)}
                      >
                        <Card className="mb-3">
                          <View className="flex-row items-center">
                            <View className="flex-1 mr-2">
                              <View className="flex-row items-center gap-2">
                                <Text
                                  className="font-sans-semibold text-text flex-shrink"
                                  numberOfLines={1}
                                >
                                  {item.name}
                                </Text>
                                {isLowConfidence && (
                                  <Badge variant="warning">{t('voiceLog.estimated')}</Badge>
                                )}
                              </View>
                              <Text className="text-xs text-text-secondary mt-0.5">
                                {portionLabel}
                              </Text>
                              <Text className="text-xs text-text-tertiary mt-0.5">
                                P: {Math.round(item.protein)}g · C: {Math.round(item.carbs)}g · F:{' '}
                                {Math.round(item.fat)}g
                              </Text>
                            </View>
                            <Text className="font-sans-bold text-text text-base mr-3">
                              {Math.round(item.calories)} cal
                            </Text>
                            <Pressable
                              onPress={() => setEditingIndex(index)}
                              hitSlop={8}
                              className="h-9 w-9 items-center justify-center rounded-full bg-surface-secondary mr-1"
                              accessibilityRole="button"
                              accessibilityLabel={`Edit ${item.name}`}
                            >
                              <Ionicons name="pencil-outline" size={16} color={c.textSecondary} />
                            </Pressable>
                            <Pressable
                              onPress={() => handleDeleteItem(index)}
                              hitSlop={8}
                              className="h-9 w-9 items-center justify-center rounded-full bg-danger/10"
                              accessibilityRole="button"
                              accessibilityLabel={`Delete ${item.name}`}
                            >
                              <Ionicons name="trash-outline" size={16} color={c.danger} />
                            </Pressable>
                          </View>
                        </Card>
                      </Animated.View>
                    );
                  })}

                  {/* Total */}
                  <Animated.View entering={FadeInDown.duration(300).delay(400)}>
                    <Card className="mb-6 bg-surface-secondary">
                      <Text className="text-xs font-sans-semibold text-text-tertiary uppercase tracking-wider mb-1">
                        {t('voiceLog.total')}
                      </Text>
                      <Text className="text-text font-sans-bold text-2xl">{totalCalories} cal</Text>
                      <Text className="text-xs text-text-secondary mt-1">
                        P: {totalProtein}g · C: {totalCarbs}g · F: {totalFat}g
                      </Text>
                    </Card>
                  </Animated.View>
                </>
              )}

              {/* Zero items fallback */}
              {draftItems.length === 0 && (
                <Animated.View
                  entering={FadeInDown.duration(300).delay(150)}
                  className="items-center py-10"
                >
                  <View className="h-16 w-16 rounded-full bg-surface-card border border-surface-border items-center justify-center mb-4">
                    <Ionicons name="alert-circle-outline" size={32} color={c.textTertiary} />
                  </View>
                  <Text className="text-text-secondary text-base text-center font-sans-medium">
                    {t('voiceLog.noFoodsIdentified')}
                  </Text>
                  <Text className="text-text-tertiary mt-1 text-sm text-center">
                    {t('voiceLog.addManually')}
                  </Text>
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={() => navigation.navigate('QuickAdd')}
                    className="mt-5"
                    accessibilityLabel={t('voiceLog.addEntryManually')}
                  >
                    {t('voiceLog.addEntryManually')}
                  </Button>
                </Animated.View>
              )}

              {error ? (
                <View className="mb-4 rounded-2xl bg-danger/10 px-4 py-3">
                  <Text className="text-center text-danger text-sm font-sans-medium">{error}</Text>
                </View>
              ) : null}

              <View className="gap-3">
                {draftItems.length > 0 && (
                  <Button
                    onPress={handleSave}
                    loading={screenState === 'saving'}
                    disabled={screenState === 'saving'}
                    accessibilityLabel={t('voiceLog.logMeal')}
                  >
                    {t('voiceLog.logMeal')}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onPress={handleReset}
                  accessibilityLabel={t('voiceLog.recordAgain')}
                >
                  {t('voiceLog.recordAgain')}
                </Button>
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Edit item modal */}
      {editingIndex !== null && draftItems[editingIndex] !== undefined && (
        <EditItemModal
          item={draftItems[editingIndex]}
          onSave={(updated) => handleEditSave(editingIndex, updated)}
          onClose={() => setEditingIndex(null)}
          t={t}
          c={c}
        />
      )}

      {/* Success overlay */}
      {screenState === 'success' && (
        <RNAnimated.View
          style={{ opacity: successOpacity }}
          className="absolute inset-0 items-center justify-center bg-black/40"
        >
          <RNAnimated.View
            style={{ transform: [{ scale: successScale }] }}
            className="h-28 w-28 rounded-full bg-success items-center justify-center"
          >
            <Ionicons name="checkmark" size={60} color="#ffffff" />
          </RNAnimated.View>
          <Text className="mt-5 text-white font-sans-semibold text-lg">
            {t('voiceLog.mealLogged')}
          </Text>
        </RNAnimated.View>
      )}
    </View>
  );
}
