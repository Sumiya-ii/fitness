import { useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BackButton, Card, EmptyState } from '../../components/ui';
import { mealsApi, type FavoriteItem, type RecentItem } from '../../api/meals';
import { useLocale } from '../../i18n';
import { useColors } from '../../theme';
import type { LogStackScreenProps } from '../../navigation/types';

type Props = LogStackScreenProps<'FavoritesRecents'>;

type Tab = 'favorites' | 'recents';

export function FavoritesRecentsScreen() {
  const { t } = useLocale();
  const c = useColors();
  const navigation = useNavigation<Props['navigation']>();
  const [tab, setTab] = useState<Tab>('recents');
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [recents, setRecents] = useState<RecentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    try {
      const [favRes, recRes] = await Promise.all([
        mealsApi.getFavorites(50),
        mealsApi.getRecents(50),
      ]);
      setFavorites(favRes.data);
      setRecents(recRes.data);
      setFavoritedIds(new Set(favRes.data.map((f) => f.foodId)));
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleTabChange = (newTab: Tab) => {
    Haptics.selectionAsync();
    setTab(newTab);
  };

  const toggleFavorite = async (foodId: string) => {
    const isFav = favoritedIds.has(foodId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (isFav) {
        await mealsApi.removeFavorite(foodId);
        setFavoritedIds((prev) => {
          const next = new Set(prev);
          next.delete(foodId);
          return next;
        });
        setFavorites((prev) => prev.filter((f) => f.foodId !== foodId));
      } else {
        await mealsApi.addFavorite(foodId);
        setFavoritedIds((prev) => new Set(prev).add(foodId));
        const item = recents.find((r) => r.foodId === foodId);
        if (item) {
          setFavorites((prev) => [
            {
              id: `opt-${foodId}`,
              foodId,
              name: item.name,
              caloriesPer100g: 0,
              proteinPer100g: 0,
              servingCount: 1,
              favoritedAt: new Date().toISOString(),
            },
            ...prev,
          ]);
        }
      }
    } catch {
      // ignore
    }
  };

  const handleQuickLog = (_item: FavoriteItem | RecentItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('TextSearch');
  };

  const renderFavorite = ({ item, index }: { item: FavoriteItem; index: number }) => (
    <Animated.View entering={FadeInDown.duration(300).delay(Math.min(index * 40, 200))}>
      <Card
        pressable
        onPress={() => handleQuickLog(item)}
        className="mb-3 flex-row items-center justify-between"
      >
        <View className="flex-1 mr-3">
          <Text className="font-sans-semibold text-text" numberOfLines={1}>
            {item.name}
          </Text>
          <Text className="text-sm text-text-secondary mt-0.5">
            {item.caloriesPer100g} cal / 100g
          </Text>
        </View>
        <Pressable
          onPress={() => toggleFavorite(item.foodId)}
          className="h-11 w-11 items-center justify-center rounded-full"
          accessibilityRole="button"
          accessibilityLabel={
            favoritedIds.has(item.foodId) ? 'Remove from favorites' : 'Add to favorites'
          }
        >
          <Ionicons
            name={favoritedIds.has(item.foodId) ? 'heart' : 'heart-outline'}
            size={24}
            color={favoritedIds.has(item.foodId) ? c.danger : c.textTertiary}
          />
        </Pressable>
      </Card>
    </Animated.View>
  );

  const renderRecent = ({ item, index }: { item: RecentItem; index: number }) => {
    // Only catalog-backed recents can be favorited; voice/photo recents
    // (canonicalFoodId only) lack a Food row to attach a Favorite to.
    const favoritableFoodId = item.foodId;
    return (
      <Animated.View entering={FadeInDown.duration(300).delay(Math.min(index * 40, 200))}>
        <Card
          pressable
          onPress={() => handleQuickLog(item)}
          className="mb-3 flex-row items-center justify-between"
        >
          <View className="flex-1 mr-3">
            <Text className="font-sans-semibold text-text" numberOfLines={1}>
              {item.name}
            </Text>
            <Text className="text-sm text-text-secondary mt-0.5">{item.lastCalories} cal</Text>
          </View>
          {favoritableFoodId ? (
            <Pressable
              onPress={() => toggleFavorite(favoritableFoodId)}
              className="h-11 w-11 items-center justify-center rounded-full"
              accessibilityRole="button"
              accessibilityLabel={
                favoritedIds.has(favoritableFoodId) ? 'Remove from favorites' : 'Add to favorites'
              }
            >
              <Ionicons
                name={favoritedIds.has(favoritableFoodId) ? 'heart' : 'heart-outline'}
                size={24}
                color={favoritedIds.has(favoritableFoodId) ? c.danger : c.textTertiary}
              />
            </Pressable>
          ) : null}
        </Card>
      </Animated.View>
    );
  };

  const listData = tab === 'favorites' ? favorites : recents;
  const isEmpty = listData.length === 0;

  return (
    <SafeAreaView className="flex-1 bg-surface-app" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-5 py-3">
        <BackButton />
        <Text className="ml-3 text-lg font-sans-semibold text-text">{t('favRecents.title')}</Text>
      </View>

      {/* Tab bar */}
      <View className="flex-row mx-5 mb-4 rounded-2xl bg-surface-card p-1">
        {(['favorites', 'recents'] as const).map((tabKey) => {
          const isActive = tab === tabKey;
          return (
            <Pressable
              key={tabKey}
              onPress={() => handleTabChange(tabKey)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={t(`favRecents.${tabKey}`)}
              className={`flex-1 items-center rounded-xl py-2.5 ${
                isActive ? 'bg-primary-500' : ''
              }`}
            >
              <Text
                className={`text-sm font-sans-semibold ${
                  isActive ? 'text-on-primary' : 'text-text-secondary'
                }`}
              >
                {t(`favRecents.${tabKey}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      ) : isEmpty ? (
        <EmptyState
          icon={tab === 'favorites' ? 'heart' : 'list'}
          title={tab === 'favorites' ? t('favRecents.noFavorites') : t('favRecents.noRecents')}
          subtitle={
            tab === 'favorites' ? t('favRecents.noFavoritesDesc') : t('favRecents.noRecentsDesc')
          }
        />
      ) : (
        <FlatList<FavoriteItem | RecentItem>
          data={listData}
          keyExtractor={(item) =>
            item.foodId ?? `canon:${'canonicalFoodId' in item ? item.canonicalFoodId : 'unknown'}`
          }
          renderItem={({ item, index }) =>
            tab === 'favorites'
              ? renderFavorite({ item: item as FavoriteItem, index })
              : renderRecent({ item: item as RecentItem, index })
          }
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />
          }
        />
      )}
    </SafeAreaView>
  );
}
