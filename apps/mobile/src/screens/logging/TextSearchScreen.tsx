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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Input, Button, Card, Badge } from '../../components/ui';
import { mealsApi, type FoodSearchResult } from '../../api/meals';
import type { LogStackScreenProps, LogStackParamList } from '../../navigation/types';
import type { RouteProp } from '@react-navigation/native';

type Props = LogStackScreenProps<'TextSearch'>;

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debouncedValue;
}

export function TextSearchScreen() {
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
    setSelectedFood({ food, servingId, quantity: 1 });
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

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center gap-3 border-b border-surface-border px-4 py-3">
          <Pressable onPress={() => navigation.goBack()} className="p-3 -m-3">
            <Ionicons name="arrow-back" size={24} color="#111218" />
          </Pressable>
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder="Search foods..."
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            className="flex-1"
            containerClassName="flex-1"
          />
        </View>

        <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
          {loading && (
            <View className="py-8">
              <ActivityIndicator size="large" color="#1f2028" />
            </View>
          )}

          {error && (
            <View className="px-4 py-4">
              <Text className="text-center text-danger">{error}</Text>
            </View>
          )}

          {!loading && results.length > 0 && (
            <View className="px-4 py-4">
              {results.map((food) => {
                const isExpanded = expandedId === food.id;
                const cal = food.nutrients?.caloriesPer100g ?? 0;
                return (
                  <Card key={food.id} className="mb-3">
                    <Pressable
                      onPress={() =>
                        setExpandedId(isExpanded ? null : food.id)
                      }
                    >
                      <View className="flex-row items-center justify-between">
                        <View className="flex-1">
                          <Text className="font-sans-semibold text-text">
                            {food.normalizedName}
                          </Text>
                          <Text className="text-sm text-text-secondary">
                            {cal} cal / 100g
                          </Text>
                        </View>
                        <Badge variant="neutral">
                          {food.servings.length} serving{food.servings.length !== 1 ? 's' : ''}
                        </Badge>
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color="#9a9caa"
                        />
                      </View>
                    </Pressable>

                    {isExpanded && (
                      <View className="mt-4 border-t border-surface-border pt-4">
                        <Text className="mb-2 text-sm font-sans-medium text-text-secondary">
                          Select serving
                        </Text>
                        {food.servings.map((s) => (
                          <Pressable
                            key={s.id}
                            onPress={() => handleSelectServing(food, s.id)}
                            className="mb-2 flex-row items-center justify-between rounded-xl bg-surface-secondary py-2.5 px-3"
                          >
                            <Text className="font-sans-medium text-text">
                              {s.label}
                            </Text>
                            <Text className="text-sm text-text-tertiary">
                              {s.gramsPerUnit}g
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </Card>
                );
              })}
            </View>
          )}

          {selectedFood && (
            <View className="border-t border-surface-border bg-white px-4 py-4">
              <Text className="mb-3 font-sans-semibold text-text">
                {selectedFood.food.normalizedName}
              </Text>
              <View className="mb-4 flex-row items-center justify-center gap-4">
                <Pressable
                  onPress={() =>
                    setSelectedFood((p) =>
                      p && p.quantity > 0.5
                        ? { ...p, quantity: p.quantity - 0.5 }
                        : p
                    )
                  }
                  className="h-10 w-10 items-center justify-center rounded-full bg-surface-secondary"
                >
                  <Ionicons name="remove" size={24} color="#777985" />
                </Pressable>
                <Text className="min-w-[60px] text-center text-xl font-sans-bold text-text">
                  {selectedFood.quantity}
                </Text>
                <Pressable
                  onPress={() =>
                    setSelectedFood((p) =>
                      p ? { ...p, quantity: p.quantity + 0.5 } : p
                    )
                  }
                  className="h-10 w-10 items-center justify-center rounded-full bg-surface-secondary"
                >
                  <Ionicons name="add" size={24} color="#777985" />
                </Pressable>
              </View>
              <View className="mb-4 rounded-xl bg-surface-secondary p-3">
                <Text className="mb-2 text-sm font-sans-medium text-text-secondary">
                  Calculated macros
                </Text>
                <View className="flex-row flex-wrap gap-4">
                  <Text className="text-text">
                    {calcCal} cal
                  </Text>
                  <Text className="text-text">
                    P: {calcProtein}g
                  </Text>
                  <Text className="text-text">
                    C: {calcCarbs}g
                  </Text>
                  <Text className="text-text">
                    F: {calcFat}g
                  </Text>
                </View>
              </View>
              <Button
                onPress={handleAddToLog}
                loading={saving}
                disabled={saving}
              >
                Add to Log
              </Button>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
