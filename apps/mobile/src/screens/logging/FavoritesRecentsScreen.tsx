import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Card, EmptyState } from '../../components/ui';
import { mealsApi, type FavoriteItem, type RecentItem } from '../../api/meals';
import type { LogStackScreenProps } from '../../navigation/types';

type Props = LogStackScreenProps<'FavoritesRecents'>;

type Tab = 'favorites' | 'recents';

export function FavoritesRecentsScreen() {
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
    }, [loadData])
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
        <Text className="font-sans-semibold text-text">
          {item.name}
        </Text>
        <Text className="text-sm text-text-secondary">
          {item.caloriesPer100g} cal / 100g
        </Text>
      </View>
      <Pressable
        onPress={() => toggleFavorite(item.foodId)}
        className="p-2"
      >
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
        <Text className="font-sans-semibold text-text">
          {item.name}
        </Text>
        <Text className="text-sm text-text-secondary">
          Last: {item.lastCalories} cal
        </Text>
      </View>
      <Pressable
        onPress={() => toggleFavorite(item.foodId)}
        className="p-2"
      >
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
        <Pressable onPress={() => navigation.goBack()} className="p-1">
          <Ionicons name="arrow-back" size={24} color="#111218" />
        </Pressable>
        <Text className="ml-4 text-lg font-sans-semibold text-text">
          Favorites & Recents
        </Text>
      </View>

      {/* Tabs */}
      <View className="flex-row border-b border-surface-border px-4">
        <Pressable
          onPress={() => setTab('favorites')}
          className={`border-b-2 py-3 px-4 ${
            tab === 'favorites'
              ? 'border-primary-500'
              : 'border-transparent'
          }`}
        >
          <Text
            className={`font-sans-medium ${
              tab === 'favorites'
                ? 'text-primary-600'
                : 'text-text-secondary'
            }`}
          >
            Favorites
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
              tab === 'recents'
                ? 'text-primary-600'
                : 'text-text-secondary'
            }`}
          >
            Recents
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
          title={tab === 'favorites' ? 'No favorites yet' : 'No recent meals'}
          subtitle={
            tab === 'favorites'
              ? 'Tap the heart on foods to add them here'
              : 'Log some meals to see them here'
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
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#1f2028"
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
