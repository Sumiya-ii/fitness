import { useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { SkeletonLoader } from '../components/ui';
import { mealsApi, type FoodSearchResult } from '../api/meals';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../navigation/types';
import { useLocale } from '../i18n';
import { useColors } from '../theme';

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
  const { t } = useLocale();
  const c = useColors();
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('MainTabs', {
      screen: 'Log',
      params: {
        screen: 'TextSearch',
        params: { initialQuery: item.normalizedName },
      },
    } as never);
  };

  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    handleSearch('');
  };

  return (
    <View className="flex-1 bg-surface-app">
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="px-5 pt-2 pb-3">
          <Text className="text-2xl font-sans-bold text-text mb-3">{t('search.title')}</Text>
          <View className="flex-row items-center rounded-2xl bg-surface-card border border-surface-border px-4 py-3">
            <Ionicons name="search" size={20} color={c.textTertiary} />
            <TextInput
              className="flex-1 ml-3 text-base text-text font-sans-medium"
              placeholder={t('search.placeholder')}
              placeholderTextColor={c.textTertiary}
              value={query}
              onChangeText={handleSearch}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel={t('search.placeholder')}
            />
            {query.length > 0 && (
              <Pressable
                onPress={handleClear}
                className="h-11 w-11 items-center justify-center -mr-2"
                accessibilityRole="button"
                accessibilityLabel={t('common.cancel')}
              >
                <Ionicons name="close-circle" size={20} color={c.textTertiary} />
              </Pressable>
            )}
          </View>
        </View>

        {query.trim().length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <View className="h-20 w-20 rounded-full bg-surface-card border border-surface-border items-center justify-center mb-4">
              <Ionicons name="search-outline" size={36} color={c.muted} />
            </View>
            <Text className="text-base font-sans-semibold text-text mb-1">
              {t('search.findAny')}
            </Text>
            <Text className="text-sm text-text-secondary text-center font-sans leading-5">
              {t('search.findAnyDesc')}
            </Text>
          </View>
        ) : searching ? (
          <View className="px-5 pt-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <View
                key={`search-skeleton-${index}`}
                className="rounded-2xl bg-surface-card border border-surface-border p-4 mb-2"
              >
                <View className="flex-row items-center">
                  <SkeletonLoader variant="circle" width={40} />
                  <View className="flex-1 ml-3">
                    <SkeletonLoader width="70%" height={14} />
                    <SkeletonLoader width="88%" height={12} className="mt-2" />
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : results.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <View className="h-16 w-16 rounded-full bg-surface-card items-center justify-center mb-4">
              <Ionicons name="nutrition-outline" size={28} color={c.textTertiary} />
            </View>
            <Text className="text-base font-sans-medium text-text mb-1">
              {t('search.noResults')}
            </Text>
            <Text className="text-sm text-text-secondary text-center font-sans leading-5">
              {t('search.noResultsDesc')}
            </Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
            ItemSeparatorComponent={() => <View className="h-2" />}
            renderItem={({ item, index }) => {
              const display = getFoodDisplayData(item);
              return (
                <Animated.View entering={FadeInDown.delay(50 * Math.min(index, 5)).duration(300)}>
                  <Pressable
                    className="rounded-2xl bg-surface-card border border-surface-border p-4 flex-row items-center"
                    onPress={() => handleSelectFood(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`${display.name}, ${display.calories} kcal`}
                  >
                    <View
                      className="h-10 w-10 rounded-full items-center justify-center mr-3"
                      style={{ backgroundColor: c.primary + '15' }}
                    >
                      <Ionicons name="nutrition" size={18} color={c.primary} />
                    </View>
                    <View className="flex-1">
                      <Text className="font-sans-medium text-text" numberOfLines={1}>
                        {display.name}
                      </Text>
                      <Text className="text-xs text-text-secondary mt-0.5 font-sans">
                        {display.calories} kcal {display.protein}g P {display.carbs}g C{' '}
                        {display.fat}g F
                      </Text>
                    </View>
                    <View
                      className="h-8 w-8 rounded-full items-center justify-center"
                      style={{ backgroundColor: c.primary + '15' }}
                    >
                      <Ionicons name="add" size={18} color={c.primary} />
                    </View>
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
