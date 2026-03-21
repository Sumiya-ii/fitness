import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import { BackButton } from '../../components/ui';
import { api } from '../../api';
import { mealsApi } from '../../api/meals';
import { trackEvent, EVENTS } from '../../utils/analytics';
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
  confidence: number; // 0.0–1.0
}

interface VoiceDraft {
  id: string;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  transcription?: string;
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
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 30;
const MAX_RECORDING_SECONDS = 60;
const WARN_RECORDING_SECONDS = 45;

function getDeviceLocale(): 'mn' | 'en' {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    return locale.startsWith('mn') ? 'mn' : 'en';
  } catch {
    return 'mn';
  }
}

function getProcessingMessage(
  screenState: ScreenState,
  draftWorkerStatus: 'waiting' | 'active' | null,
): string {
  if (screenState === 'uploading') return 'Uploading audio...';
  if (draftWorkerStatus === 'active') return 'Analyzing nutrition...';
  return 'Transcribing your voice...';
}

// ── Edit Item Modal ──────────────────────────────────────────────────────────

interface EditItemModalProps {
  item: ParsedFoodItem;
  onSave: (updated: ParsedFoodItem) => void;
  onClose: () => void;
}

function EditItemModal({ item, onSave, onClose }: EditItemModalProps) {
  const [name, setName] = useState(item.name);
  const [calories, setCalories] = useState(String(Math.round(item.calories)));
  const [protein, setProtein] = useState(String(item.protein));
  const [carbs, setCarbs] = useState(String(item.carbs));
  const [fat, setFat] = useState(String(item.fat));

  const handleSave = () => {
    const cal = parseFloat(calories);
    if (isNaN(cal) || cal < 0) {
      Alert.alert('Invalid', 'Enter valid calories');
      return;
    }
    onSave({
      ...item,
      name: name.trim() || item.name,
      calories: Math.round(cal),
      protein: parseFloat(protein) || 0,
      carbs: parseFloat(carbs) || 0,
      fat: parseFloat(fat) || 0,
      confidence: 1.0, // user edited = fully confident
    });
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <Pressable className="flex-1 bg-black/40" onPress={onClose} />
        <View className="bg-surface-card rounded-t-3xl px-5 pt-5 pb-8">
          <View className="flex-row items-center justify-between mb-5">
            <Text className="text-text font-sans-semibold text-lg">Edit food item</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color="#9a9caa" />
            </Pressable>
          </View>

          <Text className="text-xs text-text-secondary mb-1">Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            className="bg-surface-secondary rounded-xl px-4 py-3 text-text mb-4"
            placeholderTextColor="#9a9caa"
          />

          <View className="flex-row gap-3 mb-5">
            {(
              [
                { label: 'Calories', value: calories, set: setCalories },
                { label: 'Protein (g)', value: protein, set: setProtein },
                { label: 'Carbs (g)', value: carbs, set: setCarbs },
                { label: 'Fat (g)', value: fat, set: setFat },
              ] as const
            ).map(({ label, value, set }) => (
              <View key={label} className="flex-1">
                <Text className="text-xs text-text-secondary mb-1">{label}</Text>
                <TextInput
                  value={value}
                  onChangeText={set as (v: string) => void}
                  keyboardType="decimal-pad"
                  className="bg-surface-secondary rounded-xl px-2 py-3 text-text text-center"
                  placeholderTextColor="#9a9caa"
                />
              </View>
            ))}
          </View>

          <Pressable onPress={handleSave} className="rounded-2xl bg-primary-500 py-4 items-center">
            <Text className="font-sans-semibold text-text-inverse text-base">Save</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────

export function VoiceLogScreen() {
  const navigation = useNavigation<Props['navigation']>();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const [screenState, setScreenState] = useState<ScreenState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [draftItems, setDraftItems] = useState<ParsedFoodItem[]>([]);
  const [transcription, setTranscription] = useState('');
  const [mealType, setMealType] = useState<MealType>('lunch');
  const [draftWorkerStatus, setDraftWorkerStatus] = useState<'waiting' | 'active' | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);
  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  // Pulse animation when recording
  useEffect(() => {
    if (screenState === 'recording') {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.18, duration: 650, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 650, useNativeDriver: true }),
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
      Alert.alert('Permission needed', 'Microphone access is required for voice logging.');
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await recorder.stop();
    const uri = recorder.uri;
    if (!uri) {
      setError('Recording failed. Please try again.');
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
      formData.append('locale', getDeviceLocale());
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
      setError('Processing timed out. Please try again.');
      setScreenState('idle');
      return;
    }
    try {
      const res = await api.get<{ data: VoiceDraft }>(`/voice/drafts/${draftId}`);
      const d = res.data;

      if (d.status === 'active') setDraftWorkerStatus('active');
      else if (d.status === 'waiting') setDraftWorkerStatus('waiting');

      if (d.status === 'completed') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const items = d.items ?? [];
        setTranscription(d.transcription ?? '');
        setDraftItems(items);
        setScreenState('results');
        void trackEvent(EVENTS.VOICE_LOG_PROCESSED, {
          itemCount: items.length,
          totalCalories: d.totalCalories ?? 0,
          hasLowConfidenceItems: items.some((it) => it.confidence < 0.7),
          locale: getDeviceLocale(),
        });
        return;
      }

      if (d.status === 'failed') {
        setError('Processing failed. Please try again.');
        setScreenState('idle');
        return;
      }

      pollTimerRef.current = setTimeout(() => pollDraft(draftId, attempt + 1), POLL_INTERVAL_MS);
    } catch {
      setError('Failed to check processing status.');
      setScreenState('idle');
    }
  };

  const handleDeleteItem = (index: number) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

      void trackEvent(EVENTS.MEAL_LOG_SAVED, {
        source: 'voice',
        mealType,
        calories: Math.round(totalCalories),
        itemCount: draftItems.length,
      });

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Show success animation then go back
      setScreenState('success');
      successScale.setValue(0);
      successOpacity.setValue(1);
      Animated.sequence([
        Animated.spring(successScale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 120,
          friction: 8,
        }),
        Animated.delay(700),
        Animated.timing(successOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => navigation.goBack());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
      setScreenState('results');
    }
  };

  const handleReset = () => {
    setScreenState('idle');
    setDraftItems([]);
    setTranscription('');
    setError(null);
    setElapsed(0);
    setDraftWorkerStatus(null);
  };

  const timerColor = elapsed >= WARN_RECORDING_SECONDS ? 'text-amber-400' : 'text-text';
  const totalCalories = Math.round(draftItems.reduce((s, i) => s + i.calories, 0));
  const totalProtein = Math.round(draftItems.reduce((s, i) => s + i.protein, 0));
  const totalCarbs = Math.round(draftItems.reduce((s, i) => s + i.carbs, 0));
  const totalFat = Math.round(draftItems.reduce((s, i) => s + i.fat, 0));

  // Processing step index (0=uploading, 1=transcribing, 2=analyzing)
  const processingStepIndex =
    screenState === 'uploading' ? 0 : draftWorkerStatus === 'active' ? 2 : 1;

  return (
    <View className="flex-1 bg-surface-app">
      <SafeAreaView edges={['top']} className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-4 py-3 border-b border-surface-border">
          <BackButton />
          <Text className="ml-3 text-lg font-sans-semibold text-text">Voice Log</Text>
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
          {/* ── IDLE ── */}
          {screenState === 'idle' && (
            <View className="flex-1 items-center justify-center px-8 py-16">
              <Text className="text-text-secondary text-center mb-10 text-base leading-6">
                Tap the microphone and describe what you ate in Mongolian or English.
              </Text>
              <Pressable
                onPress={startRecording}
                className="h-28 w-28 rounded-full bg-primary-500 items-center justify-center"
              >
                <Ionicons name="mic" size={52} color="#ffffff" />
              </Pressable>
              <Text className="mt-5 text-text-secondary text-sm">Tap to start recording</Text>
              {error && <Text className="mt-6 text-center text-red-400 text-sm px-4">{error}</Text>}
            </View>
          )}

          {/* ── RECORDING ── */}
          {screenState === 'recording' && (
            <View className="flex-1 items-center justify-center px-8 py-16">
              <Text className="text-text-secondary text-center mb-6 text-base">
                Listening... speak clearly.
              </Text>
              <Text className={`font-sans-bold text-5xl mb-1 tabular-nums ${timerColor}`}>
                {formatElapsed(elapsed)}
              </Text>
              <Text className="text-xs text-text-secondary mb-10">
                / {formatElapsed(MAX_RECORDING_SECONDS)} max
              </Text>
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <Pressable
                  onPress={stopRecording}
                  className="h-28 w-28 rounded-full bg-red-500 items-center justify-center"
                >
                  <Ionicons name="stop" size={46} color="#ffffff" />
                </Pressable>
              </Animated.View>
              <Text className="mt-5 text-text-secondary text-sm">Tap to stop</Text>
            </View>
          )}

          {/* ── UPLOADING / PROCESSING ── */}
          {(screenState === 'uploading' || screenState === 'processing') && (
            <View className="flex-1 items-center justify-center px-8 py-16">
              <ActivityIndicator size="large" color="#1f2028" />
              <Text className="mt-5 text-text text-base font-sans-medium">
                {getProcessingMessage(screenState, draftWorkerStatus)}
              </Text>
              {/* Step progress pills */}
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
              <Text className="mt-3 text-xs text-text-secondary">
                {processingStepIndex === 0
                  ? 'Uploading · Transcribing · Analyzing'
                  : processingStepIndex === 1
                    ? 'Uploading ✓ · Transcribing · Analyzing'
                    : 'Uploading ✓ · Transcribing ✓ · Analyzing'}
              </Text>
            </View>
          )}

          {/* ── RESULTS / SAVING ── */}
          {(screenState === 'results' || screenState === 'saving') && (
            <View className="px-4 py-5">
              {/* Transcription */}
              {transcription.length > 0 && (
                <View className="rounded-xl bg-surface-card border border-surface-border p-4 mb-4">
                  <Text className="text-xs font-sans-semibold text-text-secondary uppercase tracking-wider mb-2">
                    What you said
                  </Text>
                  <Text className="text-text text-sm leading-5 italic">"{transcription}"</Text>
                </View>
              )}

              {/* Meal type chips */}
              <Text className="text-xs font-sans-semibold text-text-secondary uppercase tracking-wider mb-2">
                Meal type
              </Text>
              <View className="flex-row gap-2 mb-5">
                {MEAL_TYPES.map((type) => (
                  <Pressable
                    key={type}
                    onPress={() => setMealType(type)}
                    className={`rounded-full px-4 py-2 ${
                      mealType === type ? 'bg-primary-500' : 'bg-surface-secondary'
                    }`}
                  >
                    <Text
                      className={`font-sans-medium capitalize text-sm ${
                        mealType === type ? 'text-text-inverse' : 'text-text-secondary'
                      }`}
                    >
                      {type}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Food items with edit + delete */}
              {draftItems.length > 0 && (
                <>
                  <Text className="font-sans-semibold text-text mb-3">Identified foods</Text>
                  {draftItems.map((item, index) => {
                    const isLowConfidence = item.confidence < 0.7;
                    const portionLabel =
                      item.grams > 0
                        ? `${item.quantity} ${item.unit} · ~${item.grams}g`
                        : `${item.quantity} ${item.unit}`;
                    return (
                      <View
                        key={`${item.name}-${index}`}
                        className="rounded-xl bg-surface-card border border-surface-border p-4 mb-3"
                      >
                        <View className="flex-row items-center">
                          <View className="flex-1 mr-2">
                            <View className="flex-row items-center gap-2">
                              <Text className="font-sans-semibold text-text flex-shrink">
                                {item.name}
                              </Text>
                              {isLowConfidence && (
                                <View className="rounded-full bg-amber-100 px-2 py-0.5">
                                  <Text className="text-xs text-amber-700 font-sans-medium">
                                    Estimated
                                  </Text>
                                </View>
                              )}
                            </View>
                            <Text className="text-xs text-text-secondary mt-0.5">
                              {portionLabel}
                            </Text>
                            <Text className="text-xs text-text-secondary mt-0.5">
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
                            className="mr-3"
                          >
                            <Ionicons name="pencil-outline" size={18} color="#9a9caa" />
                          </Pressable>
                          <Pressable onPress={() => handleDeleteItem(index)} hitSlop={8}>
                            <Ionicons name="trash-outline" size={18} color="#f87171" />
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}

                  {/* Total */}
                  <View className="rounded-xl bg-surface-secondary border border-surface-border p-4 mb-6">
                    <Text className="text-xs font-sans-semibold text-text-secondary uppercase tracking-wider mb-1">
                      Total
                    </Text>
                    <Text className="text-text font-sans-bold text-2xl">{totalCalories} cal</Text>
                    <Text className="text-xs text-text-secondary mt-1">
                      P: {totalProtein}g · C: {totalCarbs}g · F: {totalFat}g
                    </Text>
                  </View>
                </>
              )}

              {/* Zero items fallback */}
              {draftItems.length === 0 && (
                <View className="items-center py-10">
                  <Ionicons name="alert-circle-outline" size={40} color="#9a9caa" />
                  <Text className="text-text-secondary mt-3 text-base text-center">
                    No food items could be identified.
                  </Text>
                  <Text className="text-text-secondary mt-1 text-sm text-center">
                    You can add it manually or try again.
                  </Text>
                  <Pressable
                    onPress={() => navigation.navigate('QuickAdd')}
                    className="mt-5 rounded-2xl bg-surface-secondary border border-surface-border px-6 py-3"
                  >
                    <Text className="font-sans-semibold text-text-secondary text-sm">
                      Add entry manually
                    </Text>
                  </Pressable>
                </View>
              )}

              {error && <Text className="mb-4 text-center text-red-400 text-sm">{error}</Text>}

              <View className="gap-3">
                {draftItems.length > 0 && (
                  <Pressable
                    onPress={handleSave}
                    disabled={screenState === 'saving'}
                    className="rounded-2xl bg-primary-500 px-6 py-4 items-center"
                  >
                    {screenState === 'saving' ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <Text className="font-sans-semibold text-text-inverse text-base">
                        Log Meal
                      </Text>
                    )}
                  </Pressable>
                )}
                <Pressable
                  onPress={handleReset}
                  className="rounded-2xl border border-surface-border px-6 py-4 items-center"
                >
                  <Text className="font-sans-semibold text-text-secondary text-base">
                    Record Again
                  </Text>
                </Pressable>
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
        />
      )}

      {/* Success overlay */}
      {screenState === 'success' && (
        <Animated.View
          style={{ opacity: successOpacity }}
          className="absolute inset-0 items-center justify-center bg-black/40"
        >
          <Animated.View
            style={{ transform: [{ scale: successScale }] }}
            className="h-28 w-28 rounded-full bg-green-500 items-center justify-center"
          >
            <Ionicons name="checkmark" size={60} color="#ffffff" />
          </Animated.View>
          <Text className="mt-5 text-white font-sans-semibold text-lg">Meal logged!</Text>
        </Animated.View>
      )}
    </View>
  );
}
