import { useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { BackButton, Card, EmptyState } from '../../components/ui';
import { mealsApi, type FavoriteItem, type RecentItem } from '../../api/meals';
import { useLocale } from '../../i18n';
import type { LogStackScreenProps } from '../../navigation/types';

type Props = LogStackScreenProps<'FavoritesRecents'>;

type Tab = 'favorites' | 'recents';

export function FavoritesRecentsScreen() {
  const { t } = useLocale();
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

  const toggleFavorite = async (foodId: string) => {
    const isFav = favoritedIds.has(foodId);
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
    // Navigate to TextSearch with pre-selected food for quick log
    navigation.navigate('TextSearch');
    // In full impl: pass foodId as param and pre-load
  };

  const renderFavorite = ({ item }: { item: FavoriteItem }) => (
    <Card
      pressable
      onPress={() => handleQuickLog(item)}
      className="mb-3 flex-row items-center justify-between"
    >
      <View className="flex-1">
        <Text className="font-sans-semibold text-text">{item.name}</Text>
        <Text className="text-sm text-text-secondary">{item.caloriesPer100g} cal / 100g</Text>
      </View>
      <Pressable onPress={() => toggleFavorite(item.foodId)} className="p-2">
        <Ionicons
          name={favoritedIds.has(item.foodId) ? 'heart' : 'heart-outline'}
          size={24}
          color={favoritedIds.has(item.foodId) ? '#ef4444' : '#9a9caa'}
        />
      </Pressable>
    </Card>
  );

  const renderRecent = ({ item }: { item: RecentItem }) => (
    <Card
      pressable
      onPress={() => handleQuickLog(item)}
      className="mb-3 flex-row items-center justify-between"
    >
      <View className="flex-1">
        <Text className="font-sans-semibold text-text">{item.name}</Text>
        <Text className="text-sm text-text-secondary">Last: {item.lastCalories} cal</Text>
      </View>
      <Pressable onPress={() => toggleFavorite(item.foodId)} className="p-2">
        <Ionicons
          name={favoritedIds.has(item.foodId) ? 'heart' : 'heart-outline'}
          size={24}
          color={favoritedIds.has(item.foodId) ? '#ef4444' : '#9a9caa'}
        />
      </Pressable>
    </Card>
  );

  const listData = tab === 'favorites' ? favorites : recents;
  const isEmpty = listData.length === 0;

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <View className="flex-row items-center border-b border-surface-border px-4 py-3">
        <BackButton />
        <Text className="ml-3 text-lg font-sans-semibold text-text">{t('favRecents.title')}</Text>
      </View>

      {/* Tabs */}
      <View className="flex-row border-b border-surface-border px-4">
        <Pressable
          onPress={() => setTab('favorites')}
          className={`border-b-2 py-3 px-4 ${
            tab === 'favorites' ? 'border-primary-500' : 'border-transparent'
          }`}
        >
          <Text
            className={`font-sans-medium ${
              tab === 'favorites' ? 'text-primary-600' : 'text-text-secondary'
            }`}
          >
            {t('favRecents.favorites')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab('recents')}
          className={`border-b-2 py-3 px-4 ${
            tab === 'recents' ? 'border-primary-500' : 'border-transparent'
          }`}
        >
          <Text
            className={`font-sans-medium ${
              tab === 'recents' ? 'text-primary-600' : 'text-text-secondary'
            }`}
          >
            {t('favRecents.recents')}
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center py-16">
          <ActivityIndicator size="large" color="#1f2028" />
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
          keyExtractor={(item) => item.foodId}
          renderItem={({ item }) =>
            tab === 'favorites'
              ? renderFavorite({ item: item as FavoriteItem })
              : renderRecent({ item: item as RecentItem })
          }
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1f2028" />
          }
        />
      )}
    </SafeAreaView>
  );
}
