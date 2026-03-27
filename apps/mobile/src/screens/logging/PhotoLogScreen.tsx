import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  Alert,
  Animated,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { BackButton, Button, Card, Badge } from '../../components/ui';
import { api } from '../../api';
import { mealsApi } from '../../api/meals';
import { useLocale } from '../../i18n';
import type { LogStackScreenProps } from '../../navigation/types';

type Props = LogStackScreenProps<'PhotoLog'>;
type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

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
}

type NutrientField = keyof Pick<
  ParsedFoodItem,
  'calories' | 'protein' | 'carbs' | 'fat' | 'fiber' | 'sugar' | 'sodium' | 'saturatedFat'
>;

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 30;
const SERVING_STEP = 0.25;
const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

function autoDetectMealType(): MealType {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 15) return 'lunch';
  if (hour >= 15 && hour < 18) return 'snack';
  if (hour >= 18 && hour < 22) return 'dinner';
  return 'snack';
}

// ── Cross-platform prompt modal (Alert.prompt is iOS-only) ──
function InputModal({
  visible,
  title,
  value,
  onSubmit,
  onCancel,
  keyboardType = 'default',
}: {
  visible: boolean;
  title: string;
  value: string;
  onSubmit: (v: string) => void;
  onCancel: () => void;
  keyboardType?: 'default' | 'decimal-pad';
}) {
  const [inputValue, setInputValue] = useState(value);
  useEffect(() => {
    if (visible) setInputValue(value);
  }, [visible, value]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable onPress={onCancel} className="flex-1 bg-black/40 items-center justify-center px-8">
        <Pressable
          onPress={() => {}}
          className="w-full rounded-2xl p-5"
          style={{
            backgroundColor: '#1c1c1e',
            shadowColor: '#000',
            shadowOpacity: 0.15,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 8 },
            elevation: 10,
          }}
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
            className="border border-surface-border rounded-xl px-4 py-3 text-base text-text font-sans-medium"
          />
          <View className="flex-row justify-end gap-3 mt-4">
            <Pressable onPress={onCancel} className="px-4 py-2">
              <Text className="text-sm font-sans-medium text-text-secondary">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => onSubmit(inputValue)}
              className="bg-text px-5 py-2 rounded-xl"
            >
              <Text className="text-sm font-sans-semibold text-white">Save</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ScanningAnimation({ isLabel, t }: { isLabel: boolean; t: (key: string) => string }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulseAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    pulseAnim.start();
    return () => pulseAnim.stop();
  }, [pulse]);

  return (
    <View className="items-center py-12 px-8">
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <View className="h-20 w-20 rounded-full bg-surface-secondary items-center justify-center mb-5">
          <Ionicons name={isLabel ? 'document-text' : 'scan'} size={40} color="#1f2028" />
        </View>
      </Animated.View>
      <Text className="text-text font-sans-semibold text-lg mb-1">
        {isLabel ? t('photoLog.readingLabel') : t('photoLog.analyzingMeal')}
      </Text>
      <Text className="text-text-secondary text-sm text-center">
        {isLabel ? t('photoLog.extractingData') : t('photoLog.identifyingFoods')}
      </Text>
    </View>
  );
}

function ServingStepper({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
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
      onChange(Math.round(parsed * 4) / 4); // snap to 0.25 increments
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
      <Text className="text-xs text-text-secondary mb-1.5">{label}</Text>
      <View className="flex-row items-center gap-2">
        <Pressable
          onPress={handleDecrement}
          className="h-9 w-9 items-center justify-center rounded-xl bg-surface-secondary active:opacity-60"
        >
          <Ionicons name="remove" size={18} color="#1f2028" />
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
          <Pressable onPress={handleStartEdit} className="min-w-[48px] items-center">
            <Text className="text-base font-sans-semibold text-text">
              {value % 1 === 0 ? value : value.toFixed(2).replace(/0$/, '')}
            </Text>
          </Pressable>
        )}
        <Pressable
          onPress={handleIncrement}
          className="h-9 w-9 items-center justify-center rounded-xl bg-surface-secondary active:opacity-60"
        >
          <Ionicons name="add" size={18} color="#1f2028" />
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
}: {
  value: number;
  unit: string;
  label: string;
  onSave: (v: number) => void;
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
      <View className="flex-1 items-center bg-surface-secondary rounded-lg py-1.5 border border-text">
        <Text className="text-xs text-text-secondary">{label}</Text>
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
      className="flex-1 items-center bg-surface-secondary rounded-lg py-1.5 active:opacity-60"
    >
      <Text className="text-xs text-text-secondary">{label}</Text>
      <View className="flex-row items-center gap-0.5">
        <Text className="text-sm font-sans-semibold text-text">
          {value}
          {unit}
        </Text>
        <Ionicons name="pencil" size={10} color="#9a9caa" />
      </View>
    </Pressable>
  );
}

export function PhotoLogScreen() {
  const { t } = useLocale();
  const navigation = useNavigation<Props['navigation']>();
  const route = useRoute<Props['route']>();
  const mode = route.params?.mode ?? 'food';
  const isLabel = mode === 'label';

  const [analyzing, setAnalyzing] = useState(false);
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
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cross-platform modal state (replaces Alert.prompt)
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
    };
  }, []);

  // Camera-first: auto-launch camera in label mode
  useEffect(() => {
    if (isLabel && !cameraLaunched) {
      setCameraLaunched(true);
      handleCapture();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setError(t('photoLog.analysisTimeout'));
      setAnalyzing(false);
      return;
    }

    try {
      const res = await api.get<{ data: PhotoDraft }>(`/photos/drafts/${draftId}`);
      const d = res.data;

      if (d.status === 'completed') {
        setDraft(d);
        const items = d.items ?? [];
        setBaseItems(items);
        setMultipliers(items.map(() => 1));
        setAnalyzing(false);
        return;
      }

      if (d.status === 'failed') {
        setError(isLabel ? t('photoLog.labelAnalysisFailed') : t('photoLog.photoAnalysisFailed'));
        setAnalyzing(false);
        return;
      }

      pollTimerRef.current = setTimeout(() => pollDraft(draftId, attempt + 1), POLL_INTERVAL_MS);
    } catch {
      setError(t('photoLog.statusCheckFailed'));
      setAnalyzing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uploadAndAnalyze = async (uri: string) => {
    setAnalyzing(true);
    setError(null);
    setDraft(null);
    setBaseItems([]);
    setMultipliers([]);
    setFoodSaved(false);

    try {
      const formData = new FormData();
      formData.append('photo', {
        uri,
        type: 'image/jpeg',
        name: isLabel ? 'label.jpg' : 'photo.jpg',
      } as unknown as Blob);

      const uploadPath = isLabel ? '/photos/upload?mode=label' : '/photos/upload';
      const res = await api.upload<{ data: { draftId: string } }>(uploadPath, formData);
      pollDraft(res.data.draftId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
      setAnalyzing(false);
    }
  };

  const handleCapture = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('common.permissionNeeded'), t('photoLog.cameraRequired'));
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
      Alert.alert(t('common.permissionNeeded'), t('photoLog.galleryRequired'));
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
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    setPhotoUri(null);
    setDraft(null);
    setBaseItems([]);
    setMultipliers([]);
    setAnalyzing(false);
    setError(null);
    setFoodSaved(false);
  };

  const handleDeleteItem = (index: number) => {
    setBaseItems((prev) => prev.filter((_, i) => i !== index));
    setMultipliers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSetMultiplier = (index: number, value: number) => {
    setMultipliers((prev) => prev.map((m, i) => (i === index ? value : m)));
  };

  const handleEditNutrient = (index: number, field: NutrientField, value: number) => {
    setBaseItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  };

  const handleEditServingGrams = (index: number, value: number) => {
    setBaseItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, servingGrams: value } : item)),
    );
  };

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
        sourceRef: 'label-scan',
        servings: [
          {
            label: `1 serving (${servingGrams}g)`,
            gramsPerUnit: servingGrams,
            isDefault: true,
          },
          {
            label: '100g',
            gramsPerUnit: 100,
            isDefault: false,
          },
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
      setError(e instanceof Error ? e.message : 'Failed to save food');
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

      await mealsApi.quickAdd({
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

      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const hasResults = draft !== null && !analyzing;
  const hasItems = effectiveItems.length > 0;

  const headerTitle = isLabel ? t('photoLog.nutritionLabel') : t('photoLog.title');

  return (
    <View className="flex-1 bg-surface-app">
      <SafeAreaView edges={['top']} className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-4 py-3 border-b border-surface-border">
          <BackButton />
          <Text className="ml-3 text-lg font-sans-semibold text-text flex-1">{headerTitle}</Text>
          {hasResults && hasItems && (
            <Pressable onPress={handleRetake}>
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
            className="flex-1"
            contentContainerStyle={{ paddingBottom: 32 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Initial state: camera / gallery picker */}
            {!photoUri && !analyzing && (
              <View className="flex-1 items-center justify-center px-6 pt-16 pb-8">
                <View className="h-16 w-16 rounded-2xl bg-surface-secondary items-center justify-center mb-5">
                  <Ionicons name={isLabel ? 'document-text' : 'camera'} size={32} color="#1f2028" />
                </View>
                <Text className="text-xl font-sans-semibold text-text mb-1">
                  {isLabel ? t('photoLog.scanLabel') : t('photoLog.logWithPhoto')}
                </Text>
                <Text className="text-text-secondary text-sm text-center mb-8">
                  {isLabel ? t('photoLog.scanLabelDesc') : t('photoLog.logWithPhotoDesc')}
                </Text>
                <View className="w-full flex-row gap-3 mb-6">
                  <Pressable
                    onPress={handleCapture}
                    className="flex-1 items-center rounded-2xl border-2 border-dashed border-surface-border py-7 bg-surface-card active:opacity-70"
                  >
                    <Ionicons name="camera-outline" size={32} color="#1f2028" />
                    <Text className="mt-2 font-sans-medium text-text text-sm">
                      {t('photoLog.camera')}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handlePickFromGallery}
                    className="flex-1 items-center rounded-2xl border-2 border-dashed border-surface-border py-7 bg-surface-card active:opacity-70"
                  >
                    <Ionicons name="images-outline" size={32} color="#1f2028" />
                    <Text className="mt-2 font-sans-medium text-text text-sm">
                      {t('photoLog.gallery')}
                    </Text>
                  </Pressable>
                </View>
                {error && <Text className="text-center text-red-400 text-sm">{error}</Text>}
              </View>
            )}

            {/* Analyzing state */}
            {analyzing && (
              <View className="px-4">
                {photoUri && (
                  <Image
                    source={{ uri: photoUri }}
                    className="mt-4 mb-2 h-52 w-full rounded-2xl bg-surface-secondary"
                    resizeMode="cover"
                  />
                )}
                <ScanningAnimation isLabel={isLabel} t={t} />
              </View>
            )}

            {/* Results state */}
            {photoUri && hasResults && (
              <View className="px-4 pt-4">
                <Image
                  source={{ uri: photoUri }}
                  className="mb-4 h-52 w-full rounded-2xl bg-surface-secondary"
                  resizeMode="cover"
                />

                {hasItems ? (
                  <>
                    {/* Meal type selector */}
                    <View className="mb-4">
                      <Text className="text-xs text-text-secondary font-sans-medium mb-2 uppercase tracking-wide">
                        {t('photoLog.mealType')}
                      </Text>
                      <View className="flex-row gap-2">
                        {MEAL_TYPES.map((type) => (
                          <Pressable
                            key={type}
                            onPress={() => setMealType(type)}
                            className={`flex-1 items-center py-2 rounded-xl border ${
                              mealType === type
                                ? 'bg-text border-text'
                                : 'bg-surface-card border-surface-border'
                            }`}
                          >
                            <Text
                              className={`text-xs font-sans-medium ${
                                mealType === type ? 'text-white' : 'text-text-secondary'
                              }`}
                            >
                              {t(`mealTypes.${type}`)}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>

                    {/* Meal name + item count / label badge */}
                    <View className="flex-row items-center justify-between mb-3">
                      <Pressable
                        className="flex-1 mr-2"
                        onPress={() => {
                          // Name editing not needed for meal name header
                        }}
                      >
                        <Text className="font-sans-semibold text-text text-base">
                          {draft?.mealName ??
                            (isLabel ? t('photoLog.product') : t('photoLog.identifiedFoods'))}
                        </Text>
                      </Pressable>
                      {isLabel ? (
                        <Badge variant="info">{t('photoLog.fromLabel')}</Badge>
                      ) : (
                        <Text className="text-xs text-text-secondary font-sans-medium">
                          {effectiveItems.length} item{effectiveItems.length !== 1 ? 's' : ''}
                        </Text>
                      )}
                    </View>

                    {/* Tap-to-edit hint (shown once) */}
                    {baseItems.length > 0 && (
                      <View className="flex-row items-center gap-1 mb-2">
                        <Ionicons name="pencil" size={11} color="#9a9caa" />
                        <Text className="text-xs text-text-secondary">Tap any value to edit</Text>
                      </View>
                    )}

                    {/* Food item cards */}
                    {baseItems.map((item, index) => {
                      const effective = getEffectiveItem(item, index);
                      const currentMultiplier = multipliers[index] ?? 1;
                      return (
                        <Card key={`${item.name}-${index}`} className="mb-3">
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
                            >
                              <View className="flex-row items-center gap-1">
                                <Text className="font-sans-semibold text-text">{item.name}</Text>
                                <Ionicons name="pencil" size={11} color="#9a9caa" />
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
                              {!isLabel && (
                                <Badge variant={item.confidence >= 0.8 ? 'success' : 'warning'}>
                                  {Math.round(item.confidence * 100)}%
                                </Badge>
                              )}
                              <Pressable
                                onPress={() => handleDeleteItem(index)}
                                className="h-7 w-7 items-center justify-center rounded-full bg-surface-secondary active:opacity-60"
                              >
                                <Ionicons name="close" size={14} color="#9a9caa" />
                              </Pressable>
                            </View>
                          </View>

                          {/* Calories — editable */}
                          <Pressable
                            onPress={() =>
                              showEditModal(
                                t('photoLog.editCalories'),
                                String(item.calories),
                                (text) => {
                                  const v = parseFloat(text);
                                  if (!isNaN(v) && v >= 0) handleEditNutrient(index, 'calories', v);
                                  setModal((m) => ({ ...m, visible: false }));
                                },
                                'decimal-pad',
                              )
                            }
                            className="active:opacity-60"
                          >
                            <View className="flex-row items-baseline gap-1 mb-1">
                              <Text className="text-2xl font-sans-semibold text-text">
                                {effective.calories}
                              </Text>
                              <Text className="text-sm font-sans-regular text-text-secondary">
                                cal
                              </Text>
                              <Ionicons
                                name="pencil"
                                size={11}
                                color="#9a9caa"
                                style={{ marginBottom: 2 }}
                              />
                            </View>
                          </Pressable>

                          {/* Macros row — editable */}
                          <View className="flex-row gap-3 mb-3">
                            <EditableValue
                              value={effective.protein}
                              unit="g"
                              label={t('photoLog.protein')}
                              onSave={(v) => {
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
                              onSave={(v) => {
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
                              onSave={(v) => {
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
                                onSave={(v) => {
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

                          {/* Serving stepper */}
                          <View className="flex-row items-end justify-between">
                            <ServingStepper
                              value={currentMultiplier}
                              onChange={(v) => handleSetMultiplier(index, v)}
                              label={
                                isLabel ? t('photoLog.numberOfServings') : t('photoLog.servingSize')
                              }
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
                                      setModal((m) => ({ ...m, visible: false }));
                                    },
                                    'decimal-pad',
                                  )
                                }
                                className="active:opacity-60"
                              >
                                <View className="flex-row items-center gap-1">
                                  <Text className="text-xs text-text-secondary">
                                    {Math.round(item.servingGrams * currentMultiplier)}g total
                                  </Text>
                                  <Ionicons name="pencil" size={9} color="#9a9caa" />
                                </View>
                              </Pressable>
                            )}
                          </View>
                        </Card>
                      );
                    })}

                    {/* Totals summary */}
                    <View className="rounded-xl bg-surface-card border border-surface-border p-4 mb-4">
                      <Text className="text-xs text-text-secondary font-sans-medium mb-2 uppercase tracking-wide">
                        {t('photoLog.total')}
                      </Text>
                      <Text className="text-3xl font-sans-semibold text-text mb-1">
                        {totalCalories}
                        <Text className="text-base font-sans-regular text-text-secondary">
                          {' '}
                          cal
                        </Text>
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
                    </View>

                    {error && (
                      <Text className="mb-4 text-center text-red-400 text-sm">{error}</Text>
                    )}

                    {/* Save to foods (label mode only) */}
                    {isLabel && !foodSaved && (
                      <Pressable
                        onPress={handleSaveToFoods}
                        disabled={savingFood}
                        className="flex-row items-center justify-center gap-2 rounded-xl border border-surface-border bg-surface-card py-3 mb-3 active:opacity-60"
                      >
                        <Ionicons name="bookmark-outline" size={18} color="#1f2028" />
                        <Text className="text-sm font-sans-semibold text-text">
                          {savingFood ? t('photoLog.saving') : t('photoLog.saveToMyFoods')}
                        </Text>
                      </Pressable>
                    )}
                    {isLabel && foodSaved && (
                      <View className="flex-row items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 py-3 mb-3">
                        <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
                        <Text className="text-sm font-sans-semibold text-green-700">
                          {t('photoLog.savedToMyFoods')}
                        </Text>
                      </View>
                    )}

                    <Button onPress={handleConfirmSave} loading={saving} disabled={saving}>
                      {t('logging.addToLog')}
                    </Button>
                  </>
                ) : (
                  /* No items found */
                  <View className="items-center py-10">
                    <View className="h-14 w-14 rounded-full bg-surface-secondary items-center justify-center mb-4">
                      <Ionicons name="search" size={28} color="#9a9caa" />
                    </View>
                    <Text className="font-sans-semibold text-text mb-1">
                      {isLabel ? t('photoLog.couldNotReadLabel') : t('photoLog.noFoodDetected')}
                    </Text>
                    <Text className="text-text-secondary text-sm text-center mb-5">
                      {isLabel ? t('photoLog.tryClearerLabel') : t('photoLog.tryClearerPhoto')}
                    </Text>
                    <Button variant="outline" onPress={handleRetake}>
                      {t('photoLog.tryAnotherPhoto')}
                    </Button>
                  </View>
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
        />
      </SafeAreaView>
    </View>
  );
}
