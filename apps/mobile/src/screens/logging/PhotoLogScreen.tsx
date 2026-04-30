import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  Alert,
  Linking,
  Animated as RNAnimated,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Sentry from '@sentry/react-native';
import { BackButton, Button, Card, Badge } from '../../components/ui';
import { api } from '../../api';
import { mealsApi, analyticsApi } from '../../api/meals';
import { useLocale } from '../../i18n';
import { useColors } from '../../theme';
import type { LogStackScreenProps } from '../../navigation/types';

type Props = LogStackScreenProps<'PhotoLog'>;
type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

type FoodSource = 'verified_db' | 'ai_estimate' | 'label' | 'user_corrected';

interface ParsedFoodItem {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  saturatedFat: number;
  servingGrams: number;
  confidence: number;
  // New fields from worker — tolerate undefined (older API / draft)
  source?: FoodSource;
  matchedFoodId?: string;
  flagged?: boolean;
  flagReason?: string;
}

interface ClarificationQuestion {
  id: string;
  text: string;
  type: 'count' | 'choice';
  choices?: string[];
}

interface PhotoDraft {
  id: string;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  mealName?: string;
  items?: ParsedFoodItem[];
  totalCalories?: number;
  totalProtein?: number;
  totalCarbs?: number;
  totalFat?: number;
  totalFiber?: number;
  totalSugar?: number;
  totalSodium?: number;
  totalSaturatedFat?: number;
  // New fields — tolerate undefined
  confidenceLevel?: 'high' | 'medium' | 'low';
  requiresClarification?: boolean;
  clarificationQuestions?: ClarificationQuestion[];
}

type NutrientField = keyof Pick<
  ParsedFoodItem,
  'calories' | 'protein' | 'carbs' | 'fat' | 'fiber' | 'sugar' | 'sodium' | 'saturatedFat'
>;

const POLL_INTERVAL_FAST_MS = 2000;
const POLL_INTERVAL_SLOW_MS = 4000;
const POLL_FAST_THRESHOLD = 15;
const MAX_POLL_ATTEMPTS = 60;
// After this many attempts (~60s: 15×2s + 8×4s ≈ 62s) show the "still processing" notice
const STILL_PROCESSING_THRESHOLD = 23;
const UPLOAD_TIMEOUT_MS = 30_000;
const SERVING_STEP = 0.25;
const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  breakfast: 'sunny-outline',
  lunch: 'restaurant-outline',
  dinner: 'moon-outline',
  snack: 'cafe-outline',
};

function autoDetectMealType(): MealType {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 15) return 'lunch';
  if (hour >= 15 && hour < 18) return 'snack';
  if (hour >= 18 && hour < 22) return 'dinner';
  return 'snack';
}

// -- Cross-platform prompt modal --
function InputModal({
  visible,
  title,
  value,
  onSubmit,
  onCancel,
  keyboardType = 'default',
  c,
}: {
  visible: boolean;
  title: string;
  value: string;
  onSubmit: (v: string) => void;
  onCancel: () => void;
  keyboardType?: 'default' | 'decimal-pad';
  c: ReturnType<typeof useColors>;
}) {
  const { t } = useLocale();
  const [inputValue, setInputValue] = useState(value);
  useEffect(() => {
    if (visible) setInputValue(value);
  }, [visible, value]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        onPress={onCancel}
        className="flex-1 bg-black/40 items-center justify-center px-8"
        accessibilityRole="button"
        accessibilityLabel={t('common.cancel')}
      >
        <Pressable
          onPress={() => {}}
          className="w-full rounded-3xl p-5 bg-surface-card border border-surface-border"
        >
          <Text className="text-base font-sans-semibold text-text mb-3">{title}</Text>
          <TextInput
            autoFocus
            value={inputValue}
            onChangeText={setInputValue}
            onSubmitEditing={() => onSubmit(inputValue)}
            keyboardType={keyboardType}
            returnKeyType="done"
            selectTextOnFocus
            className="border-2 border-surface-border rounded-2xl px-4 py-3 text-base text-text font-sans-medium"
            placeholderTextColor={c.textTertiary}
          />
          <View className="flex-row justify-end gap-3 mt-4">
            <Pressable
              onPress={onCancel}
              className="px-4 py-2.5 rounded-xl"
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Text className="text-sm font-sans-medium text-text-secondary">
                {t('common.cancel')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onSubmit(inputValue)}
              className="bg-primary-500 px-5 py-2.5 rounded-xl"
              accessibilityRole="button"
              accessibilityLabel={t('common.save')}
            >
              <Text className="text-sm font-sans-semibold text-on-primary">{t('common.save')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ScanningAnimation({
  isLabel,
  t,
  c,
}: {
  isLabel: boolean;
  t: (key: string) => string;
  c: ReturnType<typeof useColors>;
}) {
  const pulse = useRef(new RNAnimated.Value(1)).current;

  useEffect(() => {
    const pulseAnim = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulse, { toValue: 1.08, duration: 700, useNativeDriver: true }),
        RNAnimated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    pulseAnim.start();
    return () => pulseAnim.stop();
  }, [pulse]);

  return (
    <View className="items-center py-12 px-8">
      <RNAnimated.View style={{ transform: [{ scale: pulse }] }}>
        <View className="h-20 w-20 rounded-full bg-surface-card border border-surface-border items-center justify-center mb-5">
          <Ionicons name={isLabel ? 'document-text' : 'scan'} size={36} color={c.textSecondary} />
        </View>
      </RNAnimated.View>
      <Text className="text-text font-sans-semibold text-lg mb-1">
        {isLabel ? t('photoLog.readingLabel') : t('photoLog.analyzingMeal')}
      </Text>
      <Text className="text-text-secondary text-sm text-center leading-5">
        {isLabel ? t('photoLog.extractingData') : t('photoLog.identifyingFoods')}
      </Text>
    </View>
  );
}

function ServingStepper({
  value,
  onChange,
  label,
  c,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  c: ReturnType<typeof useColors>;
}) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const handleStartEdit = () => {
    setInputValue(value % 1 === 0 ? String(value) : value.toFixed(2).replace(/0$/, ''));
    setEditing(true);
  };

  const handleSubmitEdit = () => {
    const parsed = parseFloat(inputValue);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 20) {
      onChange(Math.round(parsed * 4) / 4);
    }
    setEditing(false);
  };

  const handleDecrement = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(Math.max(SERVING_STEP, value - SERVING_STEP));
  };

  const handleIncrement = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(Math.min(20, value + SERVING_STEP));
  };

  return (
    <View>
      <Text className="text-xs text-text-tertiary font-sans-medium mb-1.5">{label}</Text>
      <View className="flex-row items-center gap-2">
        <Pressable
          onPress={handleDecrement}
          accessibilityRole="button"
          accessibilityLabel="Decrease serving"
          className="h-10 w-10 items-center justify-center rounded-xl bg-surface-secondary active:opacity-60"
        >
          <Ionicons name="remove" size={18} color={c.textSecondary} />
        </Pressable>
        {editing ? (
          <View className="min-w-[48px] items-center">
            <TextInput
              autoFocus
              value={inputValue}
              onChangeText={setInputValue}
              onBlur={handleSubmitEdit}
              onSubmitEditing={handleSubmitEdit}
              keyboardType="decimal-pad"
              returnKeyType="done"
              selectTextOnFocus
              className="text-base font-sans-semibold text-text text-center p-0 min-w-[40px]"
            />
          </View>
        ) : (
          <Pressable
            onPress={handleStartEdit}
            className="min-w-[48px] items-center"
            accessibilityRole="button"
            accessibilityLabel="Edit serving count"
          >
            <Text className="text-base font-sans-semibold text-text">
              {value % 1 === 0 ? value : value.toFixed(2).replace(/0$/, '')}
            </Text>
          </Pressable>
        )}
        <Pressable
          onPress={handleIncrement}
          accessibilityRole="button"
          accessibilityLabel="Increase serving"
          className="h-10 w-10 items-center justify-center rounded-xl bg-surface-secondary active:opacity-60"
        >
          <Ionicons name="add" size={18} color={c.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
}

function EditableValue({
  value,
  unit,
  label,
  onSave,
  c,
}: {
  value: number;
  unit: string;
  label: string;
  onSave: (v: number) => void;
  c: ReturnType<typeof useColors>;
}) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(String(value));

  const handleSubmit = () => {
    const parsed = parseFloat(inputValue);
    if (!isNaN(parsed) && parsed >= 0) {
      onSave(parsed);
    } else {
      setInputValue(String(value));
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <View className="flex-1 items-center bg-surface-secondary rounded-xl py-1.5 border-2 border-primary-500">
        <Text className="text-xs text-text-tertiary font-sans-medium">{label}</Text>
        <TextInput
          autoFocus
          value={inputValue}
          onChangeText={setInputValue}
          onBlur={handleSubmit}
          onSubmitEditing={handleSubmit}
          keyboardType="decimal-pad"
          returnKeyType="done"
          className="text-sm font-sans-semibold text-text text-center p-0 min-w-[40px]"
          selectTextOnFocus
        />
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => {
        setInputValue(String(value));
        setEditing(true);
      }}
      className="flex-1 items-center bg-surface-secondary rounded-xl py-1.5 active:opacity-60"
      accessibilityRole="button"
      accessibilityLabel={`Edit ${label}: ${value}${unit}`}
    >
      <Text className="text-xs text-text-tertiary font-sans-medium">{label}</Text>
      <View className="flex-row items-center gap-0.5">
        <Text className="text-sm font-sans-semibold text-text">
          {value}
          {unit}
        </Text>
        <Ionicons name="pencil" size={10} color={c.textTertiary} />
      </View>
    </Pressable>
  );
}

const SOURCE_BADGE: Record<
  FoodSource,
  { label: keyof { [K in string]: unknown }; className: string; textClass: string }
> = {
  verified_db: {
    label: 'photoLog.sourceVerified' as const,
    className: 'bg-success/15',
    textClass: 'text-success',
  },
  ai_estimate: {
    label: 'photoLog.sourceAiEstimate' as const,
    className: 'bg-surface-secondary',
    textClass: 'text-text-secondary',
  },
  label: {
    label: 'photoLog.sourceFromLabel' as const,
    className: 'bg-info/15',
    textClass: 'text-info',
  },
  user_corrected: {
    label: 'photoLog.sourceEdited' as const,
    className: 'bg-warning/15',
    textClass: 'text-warning',
  },
};

function ProvenanceBadge({
  source,
  t,
}: {
  source: FoodSource | undefined;
  t: (k: string) => string;
}) {
  if (!source) return null;
  const cfg = SOURCE_BADGE[source];
  if (!cfg) return null;
  return (
    <View className={`self-start rounded-full px-2 py-0.5 mt-1 ${cfg.className}`}>
      <Text className={`text-xs font-sans-medium ${cfg.textClass}`}>{t(cfg.label)}</Text>
    </View>
  );
}

function FlaggedChip({
  flagReason,
  t,
  c,
}: {
  flagReason: string | undefined;
  t: (k: string) => string;
  c: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      onPress={() =>
        Alert.alert(t('photoLog.flaggedTitle'), flagReason ?? t('photoLog.flaggedNoReason'))
      }
      className="flex-row items-center gap-1 bg-warning/15 rounded-full px-2 py-0.5 mt-1"
      accessibilityRole="button"
      accessibilityLabel={t('photoLog.flaggedChip')}
    >
      <Ionicons name="warning-outline" size={11} color={c.warning} />
      <Text className="text-xs font-sans-medium text-warning">{t('photoLog.flaggedChip')}</Text>
    </Pressable>
  );
}

function ClarificationBanner({
  questions,
  onAnswerCount,
  onAnswerChoice,
  t,
  c,
}: {
  questions: ClarificationQuestion[];
  onAnswerCount: (id: string, delta: number) => void;
  onAnswerChoice: (id: string, choice: string) => void;
  t: (k: string) => string;
  c: ReturnType<typeof useColors>;
}) {
  return (
    <View className="mb-4 rounded-2xl bg-primary-500/10 border border-primary-500/30 p-4">
      <View className="flex-row items-center gap-2 mb-3">
        <Ionicons name="help-circle-outline" size={18} color={c.primary} />
        <Text className="text-sm font-sans-semibold text-primary-500">
          {t('photoLog.clarificationBanner')}
        </Text>
      </View>
      <View className="flex-row flex-wrap gap-2">
        {questions.map((q) => (
          <View key={q.id}>
            {q.type === 'count' ? (
              <View className="flex-row items-center gap-1 bg-surface-card rounded-xl px-2 py-1.5 border border-surface-border">
                <Pressable
                  onPress={() => onAnswerCount(q.id, -1)}
                  accessibilityRole="button"
                  accessibilityLabel="Decrease"
                  className="h-6 w-6 items-center justify-center"
                >
                  <Ionicons name="remove" size={14} color={c.textSecondary} />
                </Pressable>
                <Text className="text-xs font-sans-medium text-text px-1">{q.text}</Text>
                <Pressable
                  onPress={() => onAnswerCount(q.id, 1)}
                  accessibilityRole="button"
                  accessibilityLabel="Increase"
                  className="h-6 w-6 items-center justify-center"
                >
                  <Ionicons name="add" size={14} color={c.textSecondary} />
                </Pressable>
              </View>
            ) : (
              <View className="flex-row flex-wrap gap-1">
                {(q.choices ?? []).map((choice) => (
                  <Pressable
                    key={choice}
                    onPress={() => onAnswerChoice(q.id, choice)}
                    accessibilityRole="button"
                    accessibilityLabel={choice}
                    className="bg-surface-card border border-surface-border rounded-full px-3 py-1"
                  >
                    <Text className="text-xs font-sans-medium text-text">{choice}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

// -- Main Screen --

export function PhotoLogScreen() {
  const { t } = useLocale();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Props['navigation']>();
  const route = useRoute<Props['route']>();
  const mode = route.params?.mode ?? 'food';
  const isLabel = mode === 'label';

  const [analyzing, setAnalyzing] = useState(false);
  const [stillProcessing, setStillProcessing] = useState(false);
  const [draft, setDraft] = useState<PhotoDraft | null>(null);
  const [baseItems, setBaseItems] = useState<ParsedFoodItem[]>([]);
  const [multipliers, setMultipliers] = useState<number[]>([]);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingFood, setSavingFood] = useState(false);
  const [foodSaved, setFoodSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mealType, setMealType] = useState<MealType>(autoDetectMealType);
  const [cameraLaunched, setCameraLaunched] = useState(false);
  // Guardrail state
  const [reviewedItems, setReviewedItems] = useState<Set<number>>(new Set());
  const [lowConfidenceToastShown, setLowConfidenceToastShown] = useState(false);
  const [savedMealLogId, setSavedMealLogId] = useState<string | null>(null);
  const [accuracyFeedbackShown, setAccuracyFeedbackShown] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const itemsListRef = useRef<import('react-native').ScrollView | null>(null);

  const [modal, setModal] = useState<{
    visible: boolean;
    title: string;
    value: string;
    keyboardType: 'default' | 'decimal-pad';
    onSubmit: (v: string) => void;
  }>({ visible: false, title: '', value: '', keyboardType: 'default', onSubmit: () => {} });

  const showEditModal = (
    title: string,
    value: string,
    onSubmit: (v: string) => void,
    keyboardType: 'default' | 'decimal-pad' = 'default',
  ) => {
    setModal({ visible: true, title, value, keyboardType, onSubmit });
  };

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      uploadAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (isLabel && !cameraLaunched) {
      setCameraLaunched(true);
      handleCapture();
    }
    // eslint-disable-next-line
  }, []);

  const getEffectiveItem = useCallback(
    (item: ParsedFoodItem, index: number): ParsedFoodItem => {
      const m = multipliers[index] ?? 1;
      return {
        ...item,
        calories: Math.round(item.calories * m),
        protein: Math.round(item.protein * m * 10) / 10,
        carbs: Math.round(item.carbs * m * 10) / 10,
        fat: Math.round(item.fat * m * 10) / 10,
        fiber: Math.round(item.fiber * m * 10) / 10,
        sugar: Math.round(item.sugar * m * 10) / 10,
        sodium: Math.round(item.sodium * m * 10) / 10,
        saturatedFat: Math.round(item.saturatedFat * m * 10) / 10,
        servingGrams: Math.round(item.servingGrams * m),
      };
    },
    [multipliers],
  );

  const effectiveItems = baseItems.map((item, i) => getEffectiveItem(item, i));

  const totalCalories = effectiveItems.reduce((s, i) => s + i.calories, 0);
  const totalProtein = effectiveItems.reduce((s, i) => s + i.protein, 0);
  const totalCarbs = effectiveItems.reduce((s, i) => s + i.carbs, 0);
  const totalFat = effectiveItems.reduce((s, i) => s + i.fat, 0);
  const totalFiber = effectiveItems.reduce((s, i) => s + i.fiber, 0);
  const totalSugar = effectiveItems.reduce((s, i) => s + i.sugar, 0);
  const totalSodium = effectiveItems.reduce((s, i) => s + i.sodium, 0);
  const totalSaturatedFat = effectiveItems.reduce((s, i) => s + i.saturatedFat, 0);

  const pollDraft = useCallback(async (draftId: string, attempt = 0) => {
    if (attempt >= MAX_POLL_ATTEMPTS) {
      Sentry.addBreadcrumb({
        category: 'photoLog',
        message: 'poll_max_attempts_reached',
        data: { draftId, attempt },
        level: 'warning',
      });
      setError(t('photoLog.analysisTimeout'));
      setStillProcessing(false);
      setAnalyzing(false);
      return;
    }

    if (attempt === STILL_PROCESSING_THRESHOLD) {
      Sentry.addBreadcrumb({
        category: 'photoLog',
        message: 'processing_still_running',
        data: { draftId, attempt },
        level: 'info',
      });
      setStillProcessing(true);
    }

    try {
      const res = await api.get<{ data: PhotoDraft }>(`/photos/drafts/${draftId}`);
      const d = res.data;

      if (d.status === 'completed') {
        Sentry.addBreadcrumb({
          category: 'photoLog',
          message: 'processing_complete',
          data: { draftId, itemCount: d.items?.length ?? 0 },
          level: 'info',
        });
        setDraft(d);
        const items = d.items ?? [];
        setBaseItems(items);
        setMultipliers(items.map(() => 1));
        setStillProcessing(false);
        setAnalyzing(false);
        return;
      }

      if (d.status === 'failed') {
        Sentry.addBreadcrumb({
          category: 'photoLog',
          message: 'processing_failed',
          data: { draftId },
          level: 'error',
        });
        setError(isLabel ? t('photoLog.labelAnalysisFailed') : t('photoLog.photoAnalysisFailed'));
        setStillProcessing(false);
        setAnalyzing(false);
        return;
      }

      const delay = attempt < POLL_FAST_THRESHOLD ? POLL_INTERVAL_FAST_MS : POLL_INTERVAL_SLOW_MS;
      pollTimerRef.current = setTimeout(() => pollDraft(draftId, attempt + 1), delay);
    } catch {
      Sentry.addBreadcrumb({
        category: 'photoLog',
        message: 'poll_status_check_failed',
        data: { draftId, attempt },
        level: 'error',
      });
      setError(t('photoLog.statusCheckFailed'));
      setStillProcessing(false);
      setAnalyzing(false);
    }
    // eslint-disable-next-line
  }, []);

  const uploadAndAnalyze = async (uri: string) => {
    setAnalyzing(true);
    setStillProcessing(false);
    setError(null);
    setDraft(null);
    setBaseItems([]);
    setMultipliers([]);
    setFoodSaved(false);

    const abortController = new AbortController();
    uploadAbortRef.current = abortController;

    const uploadTimeout = setTimeout(() => {
      abortController.abort();
    }, UPLOAD_TIMEOUT_MS);

    Sentry.addBreadcrumb({
      category: 'photoLog',
      message: 'upload_start',
      data: { mode: isLabel ? 'label' : 'food' },
      level: 'info',
    });

    try {
      const formData = new FormData();
      formData.append('photo', {
        uri,
        type: 'image/jpeg',
        name: isLabel ? 'label.jpg' : 'photo.jpg',
      } as unknown as Blob);

      const uploadPath = isLabel ? '/photos/upload?mode=label' : '/photos/upload';
      const res = await api.upload<{ data: { draftId: string } }>(
        uploadPath,
        formData,
        abortController.signal,
      );

      Sentry.addBreadcrumb({
        category: 'photoLog',
        message: 'upload_complete',
        data: { draftId: res.data.draftId },
        level: 'info',
      });

      Sentry.addBreadcrumb({
        category: 'photoLog',
        message: 'processing_start',
        data: { draftId: res.data.draftId },
        level: 'info',
      });

      pollDraft(res.data.draftId);
    } catch (e) {
      const isAbort =
        e instanceof Error && (e.name === 'AbortError' || e.message.includes('aborted'));
      Sentry.addBreadcrumb({
        category: 'photoLog',
        message: isAbort ? 'upload_timeout' : 'upload_error',
        data: { error: e instanceof Error ? e.message : String(e) },
        level: 'error',
      });
      setError(
        isAbort
          ? t('photoLog.uploadTimeout')
          : e instanceof Error
            ? e.message
            : t('photoLog.uploadFailed'),
      );
      setAnalyzing(false);
    } finally {
      clearTimeout(uploadTimeout);
      uploadAbortRef.current = null;
    }
  };

  const handleCapture = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Sentry.addBreadcrumb({
        category: 'photoLog',
        message: 'camera_permission_denied',
        level: 'warning',
      });
      Alert.alert(t('common.permissionNeeded'), t('photoLog.cameraRequired'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('photoLog.openSettings'), onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      await uploadAndAnalyze(result.assets[0].uri);
    }
  };

  const handlePickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Sentry.addBreadcrumb({
        category: 'photoLog',
        message: 'gallery_permission_denied',
        level: 'warning',
      });
      Alert.alert(t('common.permissionNeeded'), t('photoLog.galleryRequired'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('photoLog.openSettings'), onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      await uploadAndAnalyze(result.assets[0].uri);
    }
  };

  const handleRetake = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    uploadAbortRef.current?.abort();
    uploadAbortRef.current = null;
    setPhotoUri(null);
    setDraft(null);
    setBaseItems([]);
    setMultipliers([]);
    setAnalyzing(false);
    setStillProcessing(false);
    setError(null);
    setFoodSaved(false);
    setReviewedItems(new Set());
    setLowConfidenceToastShown(false);
    setSavedMealLogId(null);
    setAccuracyFeedbackShown(false);
  };

  const handleDeleteItem = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBaseItems((prev) => prev.filter((_, i) => i !== index));
    setMultipliers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEditNutrient = (index: number, field: NutrientField, value: number) => {
    setBaseItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: value, source: 'user_corrected' as FoodSource } : item,
      ),
    );
  };

  const handleEditServingGrams = (index: number, value: number) => {
    setBaseItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, servingGrams: value, source: 'user_corrected' as FoodSource }
          : item,
      ),
    );
  };

  const handlePortionStep = useCallback(
    (index: number, newMultiplier: number) => {
      const item = baseItems[index];
      if (!item) return;
      setMultipliers((prev) => prev.map((m, i) => (i === index ? newMultiplier : m)));
      setBaseItems((prev) =>
        prev.map((it, i) => (i === index ? { ...it, source: 'user_corrected' as FoodSource } : it)),
      );
    },
    [baseItems],
  );

  const handleEditName = (index: number, name: string) => {
    setBaseItems((prev) => prev.map((item, i) => (i === index ? { ...item, name } : item)));
  };

  const handleSaveToFoods = async () => {
    if (baseItems.length === 0) return;
    setSavingFood(true);
    setError(null);

    try {
      const item = baseItems[0];
      const servingGrams = item.servingGrams || 100;
      const scale = 100 / servingGrams;

      await api.post('/foods', {
        normalizedName: item.name,
        locale: 'mn',
        sourceType: 'user',
        servings: [
          { label: `1 serving (${servingGrams}g)`, gramsPerUnit: servingGrams, isDefault: true },
          { label: '100g', gramsPerUnit: 100, isDefault: false },
        ],
        nutrients: {
          caloriesPer100g: Math.round(item.calories * scale * 10) / 10,
          proteinPer100g: Math.round(item.protein * scale * 10) / 10,
          carbsPer100g: Math.round(item.carbs * scale * 10) / 10,
          fatPer100g: Math.round(item.fat * scale * 10) / 10,
          fiberPer100g: item.fiber ? Math.round(item.fiber * scale * 10) / 10 : undefined,
          sugarPer100g: item.sugar ? Math.round(item.sugar * scale * 10) / 10 : undefined,
          sodiumPer100g: item.sodium ? Math.round(item.sodium * scale * 10) / 10 : undefined,
          saturatedFatPer100g: item.saturatedFat
            ? Math.round(item.saturatedFat * scale * 10) / 10
            : undefined,
        },
      });

      setFoodSaved(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('photoLog.saveFoodFailed'));
    } finally {
      setSavingFood(false);
    }
  };

  const handleConfirmSave = async () => {
    if (effectiveItems.length === 0) return;
    setSaving(true);
    setError(null);

    try {
      const prefix = isLabel ? 'Label' : 'Photo';
      const note = `${prefix}: ${baseItems.map((i) => i.name).join(', ')}`;

      const result = await mealsApi.quickAdd({
        calories: Math.round(totalCalories),
        proteinGrams: Math.round(totalProtein * 10) / 10,
        carbsGrams: Math.round(totalCarbs * 10) / 10,
        fatGrams: Math.round(totalFat * 10) / 10,
        sugarGrams: Math.round(totalSugar * 10) / 10,
        sodiumMg: Math.round(totalSodium * 10) / 10,
        saturatedFatGrams: Math.round(totalSaturatedFat * 10) / 10,
        note,
        source: 'photo',
        mealType,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const logId = result?.data?.id ?? null;
      setSavedMealLogId(logId);
      setAccuracyFeedbackShown(false);
      // Navigate away — accuracy toast shown in render after state settles
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('photoLog.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleAccuracyFeedback = useCallback(
    (accuracy: 'low' | 'medium' | 'high') => {
      if (!savedMealLogId) return;
      setAccuracyFeedbackShown(true);
      analyticsApi.trackEvent({
        name: 'photo_meal_accuracy',
        accuracy,
        mealLogId: savedMealLogId,
        items: baseItems.map((item) => ({
          matchedFoodId: item.matchedFoodId,
          calories: item.calories,
          source: item.source,
        })),
      });
    },
    [savedMealLogId, baseItems],
  );

  const handleMarkItemReviewed = useCallback((index: number) => {
    setReviewedItems((prev) => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  }, []);

  // Derived guardrail values
  const isLowConfidence = draft?.confidenceLevel === 'low';
  const allLowConfidenceItemsReviewed =
    !isLowConfidence || baseItems.every((_, i) => reviewedItems.has(i));
  const saveBlocked = isLowConfidence && !allLowConfidenceItemsReviewed;

  const hasResults = draft !== null && !analyzing;
  const hasItems = effectiveItems.length > 0;
  const headerTitle = isLabel ? t('photoLog.nutritionLabel') : t('photoLog.title');

  const handleMealTypeSelect = (type: MealType) => {
    Haptics.selectionAsync();
    setMealType(type);
  };

  return (
    <View className="flex-1 bg-surface-app">
      <SafeAreaView edges={['top']} className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-5 py-3">
          <BackButton />
          <Text className="ml-3 text-lg font-sans-semibold text-text flex-1">{headerTitle}</Text>
          {hasResults && hasItems && (
            <Pressable
              onPress={handleRetake}
              accessibilityRole="button"
              accessibilityLabel={t('photoLog.retake')}
              className="h-9 px-3 items-center justify-center rounded-xl bg-surface-card"
            >
              <Text className="text-sm text-text-secondary font-sans-medium">
                {t('photoLog.retake')}
              </Text>
            </Pressable>
          )}
        </View>

        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            ref={itemsListRef}
            className="flex-1"
            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 32) }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Initial state: camera / gallery picker */}
            {!photoUri && !analyzing && (
              <Animated.View
                entering={FadeInDown.duration(400)}
                className="flex-1 items-center justify-center px-6 pt-16 pb-8"
              >
                <View className="h-16 w-16 rounded-2xl bg-surface-card border border-surface-border items-center justify-center mb-5">
                  <Ionicons
                    name={isLabel ? 'document-text' : 'camera'}
                    size={32}
                    color={c.textSecondary}
                  />
                </View>
                <Text className="text-xl font-sans-semibold text-text mb-1">
                  {isLabel ? t('photoLog.scanLabel') : t('photoLog.logWithPhoto')}
                </Text>
                <Text className="text-text-secondary text-sm text-center mb-8 leading-5">
                  {isLabel ? t('photoLog.scanLabelDesc') : t('photoLog.logWithPhotoDesc')}
                </Text>
                <View className="w-full flex-row gap-3 mb-6">
                  <Pressable
                    onPress={handleCapture}
                    accessibilityRole="button"
                    accessibilityLabel={t('photoLog.camera')}
                    className="flex-1 items-center rounded-2xl border-2 border-dashed border-surface-border py-7 bg-surface-card active:opacity-70"
                  >
                    <Ionicons name="camera-outline" size={32} color={c.textSecondary} />
                    <Text className="mt-2 font-sans-medium text-text text-sm">
                      {t('photoLog.camera')}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handlePickFromGallery}
                    accessibilityRole="button"
                    accessibilityLabel={t('photoLog.gallery')}
                    className="flex-1 items-center rounded-2xl border-2 border-dashed border-surface-border py-7 bg-surface-card active:opacity-70"
                  >
                    <Ionicons name="images-outline" size={32} color={c.textSecondary} />
                    <Text className="mt-2 font-sans-medium text-text text-sm">
                      {t('photoLog.gallery')}
                    </Text>
                  </Pressable>
                </View>
                {error ? (
                  <View className="rounded-2xl bg-danger/10 px-4 py-3 w-full">
                    <Text className="text-center text-danger text-sm font-sans-medium">
                      {error}
                    </Text>
                  </View>
                ) : null}
              </Animated.View>
            )}

            {/* Analyzing state */}
            {analyzing && (
              <View className="px-5">
                {photoUri && (
                  <Image
                    source={{ uri: photoUri }}
                    className="mt-4 mb-2 h-52 w-full rounded-2xl bg-surface-card"
                    resizeMode="cover"
                    accessibilityLabel="Captured photo"
                  />
                )}
                {stillProcessing ? (
                  <View className="items-center py-12 px-8">
                    <View className="h-20 w-20 rounded-full bg-surface-card border border-surface-border items-center justify-center mb-5">
                      <Ionicons name="time-outline" size={36} color={c.textSecondary} />
                    </View>
                    <Text className="text-text font-sans-semibold text-lg mb-2">
                      {t('photoLog.stillProcessing')}
                    </Text>
                    <Pressable
                      onPress={handleRetake}
                      accessibilityRole="button"
                      accessibilityLabel={t('photoLog.retake')}
                      className="mt-4 px-6 py-2.5 rounded-xl bg-surface-card border border-surface-border"
                    >
                      <Text className="text-sm font-sans-medium text-text-secondary">
                        {t('photoLog.retake')}
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <ScanningAnimation isLabel={isLabel} t={t} c={c} />
                )}
              </View>
            )}

            {/* Results state */}
            {photoUri && hasResults && (
              <View className="px-5 pt-4">
                <Image
                  source={{ uri: photoUri }}
                  className="mb-4 h-52 w-full rounded-2xl bg-surface-card"
                  resizeMode="cover"
                  accessibilityLabel="Captured photo"
                />

                {hasItems ? (
                  <>
                    {/* Meal type selector */}
                    <Animated.View entering={FadeInDown.duration(300).delay(50)} className="mb-4">
                      <Text className="text-xs font-sans-semibold text-text-tertiary uppercase tracking-wider mb-2">
                        {t('photoLog.mealType')}
                      </Text>
                      <View className="flex-row gap-2">
                        {MEAL_TYPES.map((type) => {
                          const isSelected = mealType === type;
                          return (
                            <Pressable
                              key={type}
                              onPress={() => handleMealTypeSelect(type)}
                              accessibilityRole="button"
                              accessibilityState={{ selected: isSelected }}
                              accessibilityLabel={t(`mealTypes.${type}`)}
                              className={`flex-1 items-center py-2.5 rounded-xl ${
                                isSelected ? 'bg-primary-500' : 'bg-surface-card'
                              }`}
                            >
                              <Ionicons
                                name={MEAL_ICONS[type]}
                                size={14}
                                color={isSelected ? c.onPrimary : c.textTertiary}
                              />
                              <Text
                                className={`text-xs font-sans-medium mt-0.5 ${
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

                    {/* Clarification chips — shown when draft.requiresClarification */}
                    {draft?.requiresClarification &&
                      (draft.clarificationQuestions?.length ?? 0) > 0 && (
                        <Animated.View entering={FadeInDown.duration(300).delay(80)}>
                          <ClarificationBanner
                            questions={draft.clarificationQuestions!}
                            onAnswerCount={(id, delta) => {
                              // count questions bump the multiplier of the first item whose name matches the question id
                              const idx = baseItems.findIndex((_, i) => String(i) === id);
                              const target = idx >= 0 ? idx : 0;
                              const cur = multipliers[target] ?? 1;
                              const next = Math.max(
                                SERVING_STEP,
                                Math.round((cur + delta * SERVING_STEP) * 4) / 4,
                              );
                              handlePortionStep(target, next);
                            }}
                            onAnswerChoice={(_id, _choice) => {
                              // v1: choice answers are purely informational — no state mutation needed
                            }}
                            t={t}
                            c={c}
                          />
                        </Animated.View>
                      )}

                    {/* Header row */}
                    <Animated.View entering={FadeInDown.duration(300).delay(100)}>
                      <View className="flex-row items-center justify-between mb-3">
                        <Text className="font-sans-semibold text-text text-base">
                          {draft?.mealName ??
                            (isLabel ? t('photoLog.product') : t('photoLog.identifiedFoods'))}
                        </Text>
                        {isLabel ? (
                          <Badge variant="info">{t('photoLog.fromLabel')}</Badge>
                        ) : (
                          <Text className="text-xs text-text-tertiary font-sans-medium">
                            {t(
                              effectiveItems.length === 1
                                ? 'photoLog.itemCount_one'
                                : 'photoLog.itemCount_other',
                            ).replace('{{count}}', String(effectiveItems.length))}
                          </Text>
                        )}
                      </View>
                    </Animated.View>

                    {/* Low-confidence guard toast (one-time) */}
                    {isLowConfidence &&
                      !lowConfidenceToastShown &&
                      (() => {
                        // Trigger the one-time side-effect via a layout-safe approach
                        setTimeout(() => setLowConfidenceToastShown(true), 0);
                        return (
                          <View className="mb-3 rounded-2xl bg-warning/10 border border-warning/30 px-4 py-3 flex-row items-start gap-2">
                            <Ionicons
                              name="alert-circle-outline"
                              size={16}
                              color={c.warning}
                              style={{ marginTop: 1 }}
                            />
                            <Text className="flex-1 text-sm font-sans-medium text-warning">
                              {t('photoLog.lowConfidenceToast')}
                            </Text>
                          </View>
                        );
                      })()}

                    {/* Portion-size confirmation + food item cards */}
                    {baseItems.map((item, index) => {
                      const effective = getEffectiveItem(item, index);
                      const currentMultiplier = multipliers[index] ?? 1;
                      const isReviewed = reviewedItems.has(index);
                      const needsReview = isLowConfidence && !isReviewed;
                      return (
                        <Animated.View
                          key={`${item.name}-${index}`}
                          entering={FadeInDown.duration(250).delay(Math.min(index * 40, 200) + 150)}
                        >
                          <Pressable
                            onPress={() => needsReview && handleMarkItemReviewed(index)}
                            accessibilityRole={needsReview ? 'button' : undefined}
                            accessibilityLabel={
                              needsReview ? `${t('photoLog.tapToConfirm')} ${item.name}` : undefined
                            }
                          >
                            <Card
                              className={`mb-3 ${needsReview ? 'border-2 border-warning/50' : ''}`}
                            >
                              {/* Item header row */}
                              <View className="flex-row items-start justify-between mb-2">
                                <Pressable
                                  className="flex-1 pr-2"
                                  onPress={() =>
                                    showEditModal(t('photoLog.editName'), item.name, (text) => {
                                      if (text.trim()) handleEditName(index, text.trim());
                                      setModal((m) => ({ ...m, visible: false }));
                                    })
                                  }
                                  accessibilityRole="button"
                                  accessibilityLabel={`Edit name: ${item.name}`}
                                >
                                  <View className="flex-row items-center gap-1">
                                    <Text
                                      className="font-sans-semibold text-text"
                                      numberOfLines={1}
                                    >
                                      {item.name}
                                    </Text>
                                    <Ionicons name="pencil" size={11} color={c.textTertiary} />
                                  </View>
                                  <Text className="text-xs text-text-secondary mt-0.5">
                                    {item.servingGrams > 0
                                      ? isLabel
                                        ? `${Math.round(item.servingGrams * currentMultiplier)}g ${t('photoLog.perServing')}`
                                        : `~${Math.round(item.servingGrams * currentMultiplier)}g`
                                      : isLabel
                                        ? t('photoLog.perServing')
                                        : t('photoLog.estimatedServing')}
                                  </Text>
                                </Pressable>
                                <View className="flex-row items-center gap-2">
                                  {needsReview && (
                                    <View className="h-2 w-2 rounded-full bg-warning" />
                                  )}
                                  {isReviewed && (
                                    <Ionicons name="checkmark-circle" size={16} color={c.success} />
                                  )}
                                  {!isLabel && (
                                    <Badge variant={item.confidence >= 0.8 ? 'success' : 'warning'}>
                                      {Math.round(item.confidence * 100)}%
                                    </Badge>
                                  )}
                                  <Pressable
                                    onPress={() => handleDeleteItem(index)}
                                    className="h-8 w-8 items-center justify-center rounded-full bg-surface-secondary active:opacity-60"
                                    accessibilityRole="button"
                                    accessibilityLabel={`Remove ${item.name}`}
                                  >
                                    <Ionicons name="close" size={14} color={c.textTertiary} />
                                  </Pressable>
                                </View>
                              </View>

                              {/* Calories + provenance badge + flagged chip */}
                              <Pressable
                                onPress={() => {
                                  handleMarkItemReviewed(index);
                                  showEditModal(
                                    t('photoLog.editCalories'),
                                    String(item.calories),
                                    (text) => {
                                      const v = parseFloat(text);
                                      if (!isNaN(v) && v >= 0)
                                        handleEditNutrient(index, 'calories', v);
                                      setModal((m) => ({ ...m, visible: false }));
                                    },
                                    'decimal-pad',
                                  );
                                }}
                                className="active:opacity-60"
                                accessibilityRole="button"
                                accessibilityLabel={`Edit calories: ${effective.calories}`}
                              >
                                <View className="flex-row items-baseline gap-1 mb-1">
                                  <Text className="text-2xl font-sans-semibold text-text">
                                    {effective.calories}
                                  </Text>
                                  <Text className="text-sm text-text-secondary">cal</Text>
                                  <Ionicons name="pencil" size={11} color={c.textTertiary} />
                                </View>
                              </Pressable>
                              <View className="flex-row flex-wrap gap-2 mb-2">
                                <ProvenanceBadge source={item.source} t={t} />
                                {item.flagged && (
                                  <FlaggedChip flagReason={item.flagReason} t={t} c={c} />
                                )}
                              </View>

                              {/* Macros row */}
                              <View className="flex-row gap-3 mb-3">
                                <EditableValue
                                  value={effective.protein}
                                  unit="g"
                                  label={t('photoLog.protein')}
                                  c={c}
                                  onSave={(v) => {
                                    handleMarkItemReviewed(index);
                                    const m = multipliers[index] ?? 1;
                                    handleEditNutrient(
                                      index,
                                      'protein',
                                      m !== 0 ? Math.round((v / m) * 10) / 10 : v,
                                    );
                                  }}
                                />
                                <EditableValue
                                  value={effective.carbs}
                                  unit="g"
                                  label={t('photoLog.carbs')}
                                  c={c}
                                  onSave={(v) => {
                                    handleMarkItemReviewed(index);
                                    const m = multipliers[index] ?? 1;
                                    handleEditNutrient(
                                      index,
                                      'carbs',
                                      m !== 0 ? Math.round((v / m) * 10) / 10 : v,
                                    );
                                  }}
                                />
                                <EditableValue
                                  value={effective.fat}
                                  unit="g"
                                  label={t('photoLog.fat')}
                                  c={c}
                                  onSave={(v) => {
                                    handleMarkItemReviewed(index);
                                    const m = multipliers[index] ?? 1;
                                    handleEditNutrient(
                                      index,
                                      'fat',
                                      m !== 0 ? Math.round((v / m) * 10) / 10 : v,
                                    );
                                  }}
                                />
                                {item.fiber > 0 && (
                                  <EditableValue
                                    value={effective.fiber}
                                    unit="g"
                                    label={t('photoLog.fiber')}
                                    c={c}
                                    onSave={(v) => {
                                      handleMarkItemReviewed(index);
                                      const m = multipliers[index] ?? 1;
                                      handleEditNutrient(
                                        index,
                                        'fiber',
                                        m !== 0 ? Math.round((v / m) * 10) / 10 : v,
                                      );
                                    }}
                                  />
                                )}
                              </View>

                              {/* Portion confirmation stepper (replaces bare ServingStepper) */}
                              <View className="flex-row items-end justify-between">
                                <ServingStepper
                                  value={currentMultiplier}
                                  onChange={(v) => {
                                    handleMarkItemReviewed(index);
                                    handlePortionStep(index, v);
                                  }}
                                  label={
                                    isLabel
                                      ? t('photoLog.numberOfServings')
                                      : t('photoLog.servingSize')
                                  }
                                  c={c}
                                />
                                {item.servingGrams > 0 && (
                                  <Pressable
                                    onPress={() =>
                                      showEditModal(
                                        t('photoLog.servingWeightG'),
                                        String(item.servingGrams),
                                        (text) => {
                                          const v = parseFloat(text);
                                          if (!isNaN(v) && v > 0) handleEditServingGrams(index, v);
                                          handleMarkItemReviewed(index);
                                          setModal((m) => ({ ...m, visible: false }));
                                        },
                                        'decimal-pad',
                                      )
                                    }
                                    className="active:opacity-60"
                                    accessibilityRole="button"
                                    accessibilityLabel="Edit serving weight"
                                  >
                                    <View className="flex-row items-center gap-1">
                                      <Text className="text-xs text-text-secondary">
                                        {Math.round(item.servingGrams * currentMultiplier)}g total
                                      </Text>
                                      <Ionicons name="pencil" size={9} color={c.textTertiary} />
                                    </View>
                                  </Pressable>
                                )}
                              </View>
                            </Card>
                          </Pressable>
                        </Animated.View>
                      );
                    })}

                    {/* Totals summary */}
                    <Animated.View entering={FadeInDown.duration(300).delay(400)}>
                      <Card className="mb-4">
                        <Text className="text-xs text-text-tertiary font-sans-semibold mb-2 uppercase tracking-wider">
                          {t('photoLog.total')}
                        </Text>
                        <Text className="text-3xl font-sans-semibold text-text mb-1">
                          {totalCalories}
                          <Text className="text-base text-text-secondary"> cal</Text>
                        </Text>
                        <View className="flex-row gap-4">
                          <Text className="text-sm text-text-secondary">
                            P{' '}
                            <Text className="text-text font-sans-medium">
                              {Math.round(totalProtein)}g
                            </Text>
                          </Text>
                          <Text className="text-sm text-text-secondary">
                            C{' '}
                            <Text className="text-text font-sans-medium">
                              {Math.round(totalCarbs)}g
                            </Text>
                          </Text>
                          <Text className="text-sm text-text-secondary">
                            F{' '}
                            <Text className="text-text font-sans-medium">
                              {Math.round(totalFat)}g
                            </Text>
                          </Text>
                          {totalFiber > 0 && (
                            <Text className="text-sm text-text-secondary">
                              {t('photoLog.fiber')}{' '}
                              <Text className="text-text font-sans-medium">
                                {Math.round(totalFiber)}g
                              </Text>
                            </Text>
                          )}
                        </View>
                      </Card>
                    </Animated.View>

                    {error ? (
                      <View className="mb-4 rounded-2xl bg-danger/10 px-4 py-3">
                        <Text className="text-center text-danger text-sm font-sans-medium">
                          {error}
                        </Text>
                      </View>
                    ) : null}

                    {/* Save to foods (label mode only) */}
                    {isLabel && !foodSaved && (
                      <Pressable
                        onPress={handleSaveToFoods}
                        disabled={savingFood}
                        accessibilityRole="button"
                        accessibilityLabel={t('photoLog.saveToMyFoods')}
                        className="flex-row items-center justify-center gap-2 rounded-2xl border border-surface-border bg-surface-card py-3.5 mb-3 active:opacity-60"
                      >
                        <Ionicons name="bookmark-outline" size={18} color={c.textSecondary} />
                        <Text className="text-sm font-sans-semibold text-text">
                          {savingFood ? t('photoLog.saving') : t('photoLog.saveToMyFoods')}
                        </Text>
                      </Pressable>
                    )}
                    {isLabel && foodSaved && (
                      <View className="flex-row items-center justify-center gap-2 rounded-2xl bg-success/10 py-3.5 mb-3">
                        <Ionicons name="checkmark-circle" size={18} color={c.success} />
                        <Text className="text-sm font-sans-semibold text-success">
                          {t('photoLog.savedToMyFoods')}
                        </Text>
                      </View>
                    )}

                    {/* Save button — replaced with "Review before saving" when low confidence & blocked */}
                    {saveBlocked ? (
                      <Button
                        variant="outline"
                        onPress={() => {
                          // Scroll to top of items list to prompt review
                          itemsListRef.current?.scrollTo({ y: 0, animated: true });
                        }}
                        accessibilityLabel={t('photoLog.reviewBeforeSaving')}
                      >
                        {t('photoLog.reviewBeforeSaving')}
                      </Button>
                    ) : (
                      <Button
                        onPress={handleConfirmSave}
                        loading={saving}
                        disabled={saving}
                        accessibilityLabel={t('logging.addToLog')}
                      >
                        {t('logging.addToLog')}
                      </Button>
                    )}

                    {/* Accuracy feedback toast — shown after successful save */}
                    {savedMealLogId && !accuracyFeedbackShown && (
                      <Animated.View
                        entering={FadeInDown.duration(300)}
                        className="mt-3 rounded-2xl bg-surface-card border border-surface-border px-4 py-3"
                      >
                        <Text className="text-sm font-sans-medium text-text mb-2">
                          {t('photoLog.accuracyQuestion')}
                        </Text>
                        <View className="flex-row gap-2">
                          {(
                            [
                              { emoji: '👎', value: 'low' as const },
                              { emoji: '👌', value: 'medium' as const },
                              { emoji: '👍', value: 'high' as const },
                            ] as const
                          ).map(({ emoji, value }) => (
                            <Pressable
                              key={value}
                              onPress={() => handleAccuracyFeedback(value)}
                              className="flex-1 items-center py-2 rounded-xl bg-surface-secondary active:opacity-60"
                              accessibilityRole="button"
                              accessibilityLabel={t(`photoLog.accuracy_${value}`)}
                            >
                              <Text className="text-xl">{emoji}</Text>
                            </Pressable>
                          ))}
                        </View>
                      </Animated.View>
                    )}
                  </>
                ) : (
                  /* No items found */
                  <Animated.View entering={FadeInDown.duration(300)} className="items-center py-10">
                    <View className="h-16 w-16 rounded-full bg-surface-card border border-surface-border items-center justify-center mb-4">
                      <Ionicons name="search" size={28} color={c.textTertiary} />
                    </View>
                    <Text className="font-sans-semibold text-text mb-1">
                      {isLabel ? t('photoLog.couldNotReadLabel') : t('photoLog.noFoodDetected')}
                    </Text>
                    <Text className="text-text-secondary text-sm text-center mb-5 leading-5">
                      {isLabel ? t('photoLog.tryClearerLabel') : t('photoLog.tryClearerPhoto')}
                    </Text>
                    <Button
                      variant="outline"
                      onPress={handleRetake}
                      accessibilityLabel={t('photoLog.tryAnotherPhoto')}
                    >
                      {t('photoLog.tryAnotherPhoto')}
                    </Button>
                  </Animated.View>
                )}
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Cross-platform edit modal */}
        <InputModal
          visible={modal.visible}
          title={modal.title}
          value={modal.value}
          keyboardType={modal.keyboardType}
          onSubmit={modal.onSubmit}
          onCancel={() => setModal((m) => ({ ...m, visible: false }))}
          c={c}
        />
      </SafeAreaView>
    </View>
  );
}
