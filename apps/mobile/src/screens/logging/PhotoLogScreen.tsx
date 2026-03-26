import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { BackButton, Button, Card, Badge } from '../../components/ui';
import { api } from '../../api';
import { mealsApi } from '../../api/meals';
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

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 30;
const MULTIPLIER_OPTIONS = [0.5, 1, 1.5, 2] as const;
const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

function autoDetectMealType(): MealType {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 15) return 'lunch';
  if (hour >= 15 && hour < 18) return 'snack';
  if (hour >= 18 && hour < 22) return 'dinner';
  return 'snack';
}

function ScanningAnimation() {
  const scanLine = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const scanAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLine, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(scanLine, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    const pulseAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    scanAnim.start();
    pulseAnim.start();
    return () => {
      scanAnim.stop();
      pulseAnim.stop();
    };
  }, [scanLine, pulse]);

  return (
    <View className="items-center py-12 px-8">
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <View className="h-20 w-20 rounded-full bg-surface-secondary items-center justify-center mb-5">
          <Ionicons name="scan" size={40} color="#1f2028" />
        </View>
      </Animated.View>
      <Text className="text-text font-sans-semibold text-lg mb-1">Analyzing your meal...</Text>
      <Text className="text-text-secondary text-sm text-center">
        AI is identifying food items and calculating nutrition
      </Text>
    </View>
  );
}

export function PhotoLogScreen() {
  const navigation = useNavigation<Props['navigation']>();
  const [analyzing, setAnalyzing] = useState(false);
  const [draft, setDraft] = useState<PhotoDraft | null>(null);
  const [baseItems, setBaseItems] = useState<ParsedFoodItem[]>([]);
  const [multipliers, setMultipliers] = useState<number[]>([]);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mealType, setMealType] = useState<MealType>(autoDetectMealType);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
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
      setError('Analysis timed out. Please try again.');
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
        setError('Photo analysis failed. Please try again.');
        setAnalyzing(false);
        return;
      }

      pollTimerRef.current = setTimeout(() => pollDraft(draftId, attempt + 1), POLL_INTERVAL_MS);
    } catch {
      setError('Failed to check analysis status.');
      setAnalyzing(false);
    }
  }, []);

  const uploadAndAnalyze = async (uri: string) => {
    setAnalyzing(true);
    setError(null);
    setDraft(null);
    setBaseItems([]);
    setMultipliers([]);

    try {
      const formData = new FormData();
      formData.append('photo', {
        uri,
        type: 'image/jpeg',
        name: 'photo.jpg',
      } as unknown as Blob);

      const res = await api.upload<{ data: { draftId: string } }>('/photos/upload', formData);
      pollDraft(res.data.draftId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
      setAnalyzing(false);
    }
  };

  const handleCapture = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required.');
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
      Alert.alert('Permission needed', 'Gallery access is required.');
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
  };

  const handleDeleteItem = (index: number) => {
    setBaseItems((prev) => prev.filter((_, i) => i !== index));
    setMultipliers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSetMultiplier = (index: number, value: number) => {
    setMultipliers((prev) => prev.map((m, i) => (i === index ? value : m)));
  };

  const handleConfirmSave = async () => {
    if (effectiveItems.length === 0) return;
    setSaving(true);
    setError(null);

    try {
      const note = `Photo: ${baseItems.map((i) => i.name).join(', ')}`;

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

  return (
    <View className="flex-1 bg-surface-app">
      <SafeAreaView edges={['top']} className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-4 py-3 border-b border-surface-border">
          <BackButton />
          <Text className="ml-3 text-lg font-sans-semibold text-text flex-1">Photo Log</Text>
          {hasResults && hasItems && (
            <Pressable onPress={handleRetake}>
              <Text className="text-sm text-text-secondary font-sans-medium">Retake</Text>
            </Pressable>
          )}
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
          {/* Initial state: camera / gallery picker */}
          {!photoUri && !analyzing && (
            <View className="flex-1 items-center justify-center px-6 pt-16 pb-8">
              <View className="h-16 w-16 rounded-2xl bg-surface-secondary items-center justify-center mb-5">
                <Ionicons name="camera" size={32} color="#1f2028" />
              </View>
              <Text className="text-xl font-sans-semibold text-text mb-1">Log with Photo</Text>
              <Text className="text-text-secondary text-sm text-center mb-8">
                Take a photo of your meal and AI will calculate the calories and macros
              </Text>
              <View className="w-full flex-row gap-3 mb-6">
                <Pressable
                  onPress={handleCapture}
                  className="flex-1 items-center rounded-2xl border-2 border-dashed border-surface-border py-7 bg-surface-card active:opacity-70"
                >
                  <Ionicons name="camera-outline" size={32} color="#1f2028" />
                  <Text className="mt-2 font-sans-medium text-text text-sm">Camera</Text>
                </Pressable>
                <Pressable
                  onPress={handlePickFromGallery}
                  className="flex-1 items-center rounded-2xl border-2 border-dashed border-surface-border py-7 bg-surface-card active:opacity-70"
                >
                  <Ionicons name="images-outline" size={32} color="#1f2028" />
                  <Text className="mt-2 font-sans-medium text-text text-sm">Gallery</Text>
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
              <ScanningAnimation />
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
                      Meal Type
                    </Text>
                    <View className="flex-row gap-2">
                      {(Object.keys(MEAL_TYPE_LABELS) as MealType[]).map((type) => (
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
                            {MEAL_TYPE_LABELS[type]}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  {/* Meal name + item count */}
                  <View className="flex-row items-center justify-between mb-3">
                    <Text className="font-sans-semibold text-text text-base">
                      {draft?.mealName ?? 'Identified foods'}
                    </Text>
                    <Text className="text-xs text-text-secondary font-sans-medium">
                      {effectiveItems.length} item{effectiveItems.length !== 1 ? 's' : ''}
                    </Text>
                  </View>

                  {/* Food item cards */}
                  {baseItems.map((item, index) => {
                    const effective = getEffectiveItem(item, index);
                    const currentMultiplier = multipliers[index] ?? 1;
                    return (
                      <Card key={`${item.name}-${index}`} className="mb-3">
                        {/* Item header row */}
                        <View className="flex-row items-start justify-between mb-2">
                          <View className="flex-1 pr-2">
                            <Text className="font-sans-semibold text-text">{item.name}</Text>
                            <Text className="text-xs text-text-secondary mt-0.5">
                              {item.servingGrams > 0
                                ? `~${Math.round(item.servingGrams * currentMultiplier)}g`
                                : 'Estimated serving'}
                            </Text>
                          </View>
                          <View className="flex-row items-center gap-2">
                            <Badge variant={item.confidence >= 0.8 ? 'success' : 'warning'}>
                              {Math.round(item.confidence * 100)}%
                            </Badge>
                            <Pressable
                              onPress={() => handleDeleteItem(index)}
                              className="h-7 w-7 items-center justify-center rounded-full bg-surface-secondary active:opacity-60"
                            >
                              <Ionicons name="close" size={14} color="#9a9caa" />
                            </Pressable>
                          </View>
                        </View>

                        {/* Calories large display */}
                        <Text className="text-2xl font-sans-semibold text-text mb-1">
                          {effective.calories}
                          <Text className="text-sm font-sans-regular text-text-secondary">
                            {' '}
                            cal
                          </Text>
                        </Text>

                        {/* Macros row */}
                        <View className="flex-row gap-3 mb-3">
                          <View className="flex-1 items-center bg-surface-secondary rounded-lg py-1.5">
                            <Text className="text-xs text-text-secondary">Protein</Text>
                            <Text className="text-sm font-sans-semibold text-text">
                              {effective.protein}g
                            </Text>
                          </View>
                          <View className="flex-1 items-center bg-surface-secondary rounded-lg py-1.5">
                            <Text className="text-xs text-text-secondary">Carbs</Text>
                            <Text className="text-sm font-sans-semibold text-text">
                              {effective.carbs}g
                            </Text>
                          </View>
                          <View className="flex-1 items-center bg-surface-secondary rounded-lg py-1.5">
                            <Text className="text-xs text-text-secondary">Fat</Text>
                            <Text className="text-sm font-sans-semibold text-text">
                              {effective.fat}g
                            </Text>
                          </View>
                          {item.fiber > 0 && (
                            <View className="flex-1 items-center bg-surface-secondary rounded-lg py-1.5">
                              <Text className="text-xs text-text-secondary">Fiber</Text>
                              <Text className="text-sm font-sans-semibold text-text">
                                {effective.fiber}g
                              </Text>
                            </View>
                          )}
                        </View>

                        {/* Serving multiplier */}
                        <View>
                          <Text className="text-xs text-text-secondary mb-1.5">Serving size</Text>
                          <View className="flex-row gap-1.5">
                            {MULTIPLIER_OPTIONS.map((opt) => (
                              <Pressable
                                key={opt}
                                onPress={() => handleSetMultiplier(index, opt)}
                                className={`flex-1 items-center py-1.5 rounded-lg border ${
                                  currentMultiplier === opt
                                    ? 'bg-text border-text'
                                    : 'bg-surface-secondary border-surface-border'
                                }`}
                              >
                                <Text
                                  className={`text-xs font-sans-semibold ${
                                    currentMultiplier === opt ? 'text-white' : 'text-text-secondary'
                                  }`}
                                >
                                  {opt}×
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                        </View>
                      </Card>
                    );
                  })}

                  {/* Totals summary */}
                  <View className="rounded-xl bg-surface-card border border-surface-border p-4 mb-4">
                    <Text className="text-xs text-text-secondary font-sans-medium mb-2 uppercase tracking-wide">
                      Total
                    </Text>
                    <Text className="text-3xl font-sans-semibold text-text mb-1">
                      {totalCalories}
                      <Text className="text-base font-sans-regular text-text-secondary"> cal</Text>
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
                        <Text className="text-text font-sans-medium">{Math.round(totalFat)}g</Text>
                      </Text>
                      {totalFiber > 0 && (
                        <Text className="text-sm text-text-secondary">
                          Fiber{' '}
                          <Text className="text-text font-sans-medium">
                            {Math.round(totalFiber)}g
                          </Text>
                        </Text>
                      )}
                    </View>
                  </View>

                  {error && <Text className="mb-4 text-center text-red-400 text-sm">{error}</Text>}

                  <Button onPress={handleConfirmSave} loading={saving} disabled={saving}>
                    Log {MEAL_TYPE_LABELS[mealType]}
                  </Button>
                </>
              ) : (
                /* No items found */
                <View className="items-center py-10">
                  <View className="h-14 w-14 rounded-full bg-surface-secondary items-center justify-center mb-4">
                    <Ionicons name="search" size={28} color="#9a9caa" />
                  </View>
                  <Text className="font-sans-semibold text-text mb-1">No food detected</Text>
                  <Text className="text-text-secondary text-sm text-center mb-5">
                    Try a clearer photo with better lighting, or use manual entry
                  </Text>
                  <Button variant="outline" onPress={handleRetake}>
                    Try another photo
                  </Button>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
