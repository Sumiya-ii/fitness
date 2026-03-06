import { useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { mealsApi, type FoodSearchResult } from '../api/meals';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../navigation/types';

type NavProp = NativeStackNavigationProp<MainStackParamList>;

function getFoodDisplayData(item: FoodSearchResult) {
  const n = item.nutrients;
  return {
    name: item.normalizedName,
    calories: n ? Math.round(n.caloriesPer100g) : 0,
    protein: n ? Math.round(n.proteinPer100g) : 0,
    carbs: n ? Math.round(n.carbsPer100g) : 0,
    fat: n ? Math.round(n.fatPer100g) : 0,
  };
}

export function SearchScreen() {
  const navigation = useNavigation<NavProp>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = useCallback(async (text: string) => {
    setQuery(text);
    if (text.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await mealsApi.searchFoods(text.trim());
      setResults(res.data ?? []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleSelectFood = (item: FoodSearchResult) => {
    navigation.navigate('MainTabs', {
      screen: 'Log',
      params: {
        screen: 'TextSearch',
        params: { initialQuery: item.normalizedName },
      },
    } as never);
  };

  return (
    <View className="flex-1 bg-surface-app">
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="px-4 pt-2 pb-3">
          <Text className="text-2xl font-sans-bold text-text mb-3">
            Search Foods
          </Text>
          <View className="flex-row items-center rounded-2xl bg-surface-card border border-surface-border px-4 py-3">
            <Ionicons name="search" size={20} color="#777985" />
            <TextInput
              className="flex-1 ml-3 text-base text-text font-sans-medium"
              placeholder="Search for a food..."
              placeholderTextColor="#777985"
              value={query}
              onChangeText={handleSearch}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable onPress={() => handleSearch('')}>
                <Ionicons name="close-circle" size={20} color="#777985" />
              </Pressable>
            )}
          </View>
        </View>

        {query.trim().length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <View className="h-20 w-20 rounded-full bg-surface-card border border-surface-border items-center justify-center mb-4">
              <Ionicons name="search-outline" size={36} color="#d2d2db" />
            </View>
            <Text className="text-base font-sans-semibold text-text mb-1">
              Find any food
            </Text>
            <Text className="text-sm text-text-secondary text-center">
              Search our database of foods to log your meals quickly
            </Text>
          </View>
        ) : results.length === 0 && !searching ? (
          <View className="flex-1 items-center justify-center px-8">
            <View className="h-16 w-16 rounded-full bg-surface-card items-center justify-center mb-4">
              <Ionicons name="nutrition-outline" size={28} color="#777985" />
            </View>
            <Text className="text-base font-sans-medium text-text mb-1">
              No results found
            </Text>
            <Text className="text-sm text-text-secondary text-center">
              Try different keywords or use Quick Add to log manually
            </Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
            ItemSeparatorComponent={() => <View className="h-2" />}
            renderItem={({ item, index }) => {
              const display = getFoodDisplayData(item);
              return (
                <Animated.View entering={FadeInDown.delay(50 * index).duration(300)}>
                  <Pressable
                    className="rounded-2xl bg-surface-card border border-surface-border p-4 flex-row items-center"
                    onPress={() => handleSelectFood(item)}
                  >
                    <View className="h-10 w-10 rounded-full bg-primary-500/15 items-center justify-center mr-3">
                      <Ionicons name="nutrition" size={18} color="#1f2028" />
                    </View>
                    <View className="flex-1">
                      <Text className="font-sans-medium text-text" numberOfLines={1}>
                        {display.name}
                      </Text>
                      <Text className="text-xs text-text-secondary mt-0.5">
                        {display.calories} kcal · {display.protein}g P · {display.carbs}g C · {display.fat}g F
                      </Text>
                    </View>
                    <Ionicons name="add-circle" size={24} color="#1f2028" />
                  </Pressable>
                </Animated.View>
              );
            }}
          />
        )}
      </SafeAreaView>
    </View>
  );
}
