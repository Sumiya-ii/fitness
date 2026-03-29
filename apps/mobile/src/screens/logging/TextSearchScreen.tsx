import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BackButton, Input, Button, Card, Badge, EmptyState } from '../../components/ui';
import { mealsApi, type FoodSearchResult } from '../../api/meals';
import { useLocale } from '../../i18n';
import { useColors } from '../../theme';
import type { LogStackScreenProps, LogStackParamList } from '../../navigation/types';
import type { RouteProp } from '@react-navigation/native';

type Props = LogStackScreenProps<'TextSearch'>;

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export function TextSearchScreen() {
  const { t } = useLocale();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Props['navigation']>();
  const route = useRoute<RouteProp<LogStackParamList, 'TextSearch'>>();
  const initialQuery = route.params?.initialQuery ?? '';
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedFood, setSelectedFood] = useState<{
    food: FoodSearchResult;
    servingId: string;
    quantity: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const debouncedQuery = useDebounce(query, 400);

  const search = useCallback(async () => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await mealsApi.searchFoods(debouncedQuery, 1, 20);
      setResults(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery]);

  useEffect(() => {
    search();
  }, [search]);

  const handleSelectServing = (food: FoodSearchResult, servingId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedFood({ food, servingId, quantity: 1 });
  };

  const handleToggleExpand = (foodId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedId(expandedId === foodId ? null : foodId);
  };

  const handleAddToLog = async () => {
    if (!selectedFood) return;
    setSaving(true);
    try {
      await mealsApi.createMealLog({
        source: 'text',
        items: [
          {
            foodId: selectedFood.food.id,
            servingId: selectedFood.servingId,
            quantity: selectedFood.quantity,
          },
        ],
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add');
    } finally {
      setSaving(false);
    }
  };

  const nutrient = selectedFood?.food.nutrients;
  const serving = selectedFood?.food.servings.find((s) => s.id === selectedFood.servingId);
  const gramsPerUnit = serving?.gramsPerUnit ?? 100;
  const factor = (selectedFood?.quantity ?? 1) * (gramsPerUnit / 100);
  const calcCal = nutrient ? Math.round(nutrient.caloriesPer100g * factor) : 0;
  const calcProtein = nutrient ? Math.round(nutrient.proteinPer100g * factor * 10) / 10 : 0;
  const calcCarbs = nutrient ? Math.round(nutrient.carbsPer100g * factor * 10) / 10 : 0;
  const calcFat = nutrient ? Math.round(nutrient.fatPer100g * factor * 10) / 10 : 0;

  const handleAdjustQuantity = (delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedFood((p) => {
      if (!p) return p;
      const newQty = p.quantity + delta;
      return newQty >= 0.5 ? { ...p, quantity: newQty } : p;
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-app" edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        {/* Header with search */}
        <View className="flex-row items-center gap-3 px-5 py-3">
          <BackButton />
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder={t('search.placeholder')}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            containerClassName="flex-1"
            accessibilityLabel={t('search.placeholder')}
            leftIcon={<Ionicons name="search" size={18} color={c.textTertiary} />}
          />
        </View>

        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}
        >
          {loading && (
            <View className="py-12 items-center">
              <ActivityIndicator size="large" color={c.primary} />
            </View>
          )}

          {error ? (
            <View className="mx-5 mt-4 rounded-2xl bg-danger/10 px-4 py-3">
              <Text className="text-center text-sm font-sans-medium text-danger">{error}</Text>
            </View>
          ) : null}

          {!loading && !query.trim() && (
            <EmptyState
              icon="search"
              title={t('search.findAny')}
              subtitle={t('search.findAnyDesc')}
            />
          )}

          {!loading && query.trim() && results.length === 0 && (
            <EmptyState
              icon="search"
              title={t('search.noResults')}
              subtitle={t('search.noResultsDesc')}
            />
          )}

          {!loading && results.length > 0 && (
            <View className="px-5 pt-2">
              {results.map((food, index) => {
                const isExpanded = expandedId === food.id;
                const cal = food.nutrients?.caloriesPer100g ?? 0;
                return (
                  <Animated.View
                    key={food.id}
                    entering={FadeInDown.duration(250).delay(Math.min(index * 35, 175))}
                  >
                    <Card className="mb-3">
                      <Pressable
                        onPress={() => handleToggleExpand(food.id)}
                        accessibilityRole="button"
                        accessibilityLabel={food.normalizedName}
                        accessibilityState={{ expanded: isExpanded }}
                      >
                        <View className="flex-row items-center justify-between">
                          <View className="flex-1 mr-3">
                            <Text className="font-sans-semibold text-text" numberOfLines={1}>
                              {food.normalizedName}
                            </Text>
                            <Text className="text-sm text-text-secondary mt-0.5">
                              {cal} cal / 100g
                            </Text>
                          </View>
                          <View className="flex-row items-center gap-2">
                            <Badge variant="neutral">
                              {food.servings.length}{' '}
                              {food.servings.length !== 1
                                ? t('search.servings')
                                : t('search.serving')}
                            </Badge>
                            <Ionicons
                              name={isExpanded ? 'chevron-up' : 'chevron-down'}
                              size={20}
                              color={c.textTertiary}
                            />
                          </View>
                        </View>
                      </Pressable>

                      {isExpanded && (
                        <Animated.View entering={FadeInDown.duration(200)}>
                          <View className="mt-4 border-t border-surface-border pt-4">
                            <Text className="mb-2 text-xs font-sans-semibold text-text-tertiary uppercase tracking-wider">
                              {t('search.selectServing')}
                            </Text>
                            {food.servings.map((s) => (
                              <Pressable
                                key={s.id}
                                onPress={() => handleSelectServing(food, s.id)}
                                accessibilityRole="button"
                                accessibilityLabel={`${s.label} - ${s.gramsPerUnit}g`}
                                className="mb-2 flex-row items-center justify-between rounded-xl bg-surface-secondary py-3 px-4 active:opacity-70"
                              >
                                <Text className="font-sans-medium text-text">{s.label}</Text>
                                <Text className="text-sm text-text-tertiary font-sans-medium">
                                  {s.gramsPerUnit}g
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                        </Animated.View>
                      )}
                    </Card>
                  </Animated.View>
                );
              })}
            </View>
          )}

          {/* Selected food detail */}
          {selectedFood && (
            <Animated.View entering={FadeInDown.duration(300)}>
              <View className="mx-5 mt-2 rounded-3xl bg-surface-card border border-surface-border p-5">
                <Text className="mb-4 font-sans-semibold text-text text-base">
                  {selectedFood.food.normalizedName}
                </Text>

                {/* Quantity adjuster */}
                <View className="mb-4 flex-row items-center justify-center gap-6">
                  <Pressable
                    onPress={() => handleAdjustQuantity(-0.5)}
                    accessibilityRole="button"
                    accessibilityLabel="Decrease quantity"
                    className="h-11 w-11 items-center justify-center rounded-full bg-surface-secondary active:opacity-70"
                  >
                    <Ionicons name="remove" size={22} color={c.textSecondary} />
                  </Pressable>
                  <Text className="min-w-[60px] text-center text-2xl font-sans-bold text-text">
                    {selectedFood.quantity}
                  </Text>
                  <Pressable
                    onPress={() => handleAdjustQuantity(0.5)}
                    accessibilityRole="button"
                    accessibilityLabel="Increase quantity"
                    className="h-11 w-11 items-center justify-center rounded-full bg-surface-secondary active:opacity-70"
                  >
                    <Ionicons name="add" size={22} color={c.textSecondary} />
                  </Pressable>
                </View>

                {/* Macro summary */}
                <View className="mb-5 rounded-2xl bg-surface-secondary p-4">
                  <Text className="mb-2 text-xs font-sans-semibold text-text-tertiary uppercase tracking-wider">
                    {t('search.calculatedMacros')}
                  </Text>
                  <View className="flex-row justify-between">
                    <View className="items-center flex-1">
                      <Text className="text-lg font-sans-bold text-text">{calcCal}</Text>
                      <Text className="text-xs text-text-tertiary font-sans-medium">cal</Text>
                    </View>
                    <View className="items-center flex-1">
                      <Text className="text-lg font-sans-bold text-text">{calcProtein}g</Text>
                      <Text className="text-xs text-text-tertiary font-sans-medium">
                        {t('dashboard.protein')}
                      </Text>
                    </View>
                    <View className="items-center flex-1">
                      <Text className="text-lg font-sans-bold text-text">{calcCarbs}g</Text>
                      <Text className="text-xs text-text-tertiary font-sans-medium">
                        {t('dashboard.carbs')}
                      </Text>
                    </View>
                    <View className="items-center flex-1">
                      <Text className="text-lg font-sans-bold text-text">{calcFat}g</Text>
                      <Text className="text-xs text-text-tertiary font-sans-medium">
                        {t('dashboard.fat')}
                      </Text>
                    </View>
                  </View>
                </View>

                <Button
                  onPress={handleAddToLog}
                  loading={saving}
                  disabled={saving}
                  accessibilityLabel={t('logging.addToLog')}
                >
                  {t('logging.addToLog')}
                </Button>
              </View>
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
