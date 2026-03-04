import { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/ui';
import { mealsApi, type RecentItem } from '../api/meals';
import type { LogStackParamList } from '../navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavProp = NativeStackNavigationProp<LogStackParamList, 'LogHome'>;

export function LogScreen() {
  const navigation = useNavigation<NavProp>();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [recents, setRecents] = useState<RecentItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      mealsApi.getRecents(10).then((res) => setRecents(res.data)).catch(() => {});
    }, [])
  );

  const formatDate = (d: Date) =>
    d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

  const actionCards = [
    {
      id: 'text-search',
      title: 'Text Search',
      icon: 'search' as const,
      color: 'bg-primary-500',
      onPress: () => navigation.navigate('TextSearch'),
    },
    {
      id: 'quick-add',
      title: 'Quick Add',
      icon: 'flash' as const,
      color: 'bg-accent-500',
      onPress: () => navigation.navigate('QuickAdd'),
    },
    {
      id: 'barcode',
      title: 'Scan Barcode',
      icon: 'barcode' as const,
      color: 'bg-orange-500',
      onPress: () => navigation.navigate('BarcodeScan'),
    },
    {
      id: 'voice',
      title: 'Voice',
      icon: 'mic' as const,
      color: 'bg-blue-500',
      onPress: () => navigation.navigate('VoiceLog'),
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-slate-900" edges={['top']}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
          <Text className="text-2xl font-sans-bold text-text dark:text-slate-100">
            Log a Meal
          </Text>
          <Pressable
            onPress={() => {
              // Simple date picker - could use @react-native-community/datetimepicker
              const d = new Date(selectedDate);
              d.setDate(d.getDate() - 1);
              setSelectedDate(d);
            }}
            className="flex-row items-center gap-2 rounded-xl bg-surface-secondary px-4 py-2.5 dark:bg-slate-800"
          >
            <Ionicons name="calendar-outline" size={20} color="#475569" />
            <Text className="font-sans-medium text-text dark:text-slate-200">
              {formatDate(selectedDate)}
            </Text>
          </Pressable>
        </View>

        {/* 2x2 Action Grid */}
        <View className="flex-row flex-wrap gap-3 px-4 py-4">
          {actionCards.map((card) => (
            <Card
              key={card.id}
              pressable
              onPress={card.onPress}
              className="flex-1 min-w-[45%] max-w-[48%]"
            >
              <View
                className={`mb-3 h-12 w-12 items-center justify-center rounded-xl ${card.color}`}
              >
                <Ionicons name={card.icon} size={24} color="#ffffff" />
              </View>
              <Text className="font-sans-semibold text-text dark:text-slate-100">
                {card.title}
              </Text>
            </Card>
          ))}
        </View>

        {/* Photo Card - Full Width */}
        <View className="px-4 pb-4">
          <Card
            pressable
            onPress={() => navigation.navigate('PhotoLog')}
            className="flex-row items-center gap-4"
          >
            <View className="h-14 w-14 items-center justify-center rounded-xl bg-purple-500">
              <Ionicons name="camera" size={28} color="#ffffff" />
            </View>
            <View className="flex-1">
              <Text className="font-sans-semibold text-text dark:text-slate-100">
                Photo
              </Text>
              <Text className="text-sm text-text-secondary dark:text-slate-400">
                Snap a photo of your meal
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
          </Card>
        </View>

        {/* Recent Meals Section */}
        <View className="px-4 pb-8">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-lg font-sans-semibold text-text dark:text-slate-100">
              Recent Meals
            </Text>
            <Pressable onPress={() => navigation.navigate('FavoritesRecents')}>
              <Text className="text-sm font-sans-medium text-primary-600 dark:text-primary-400">
                See all
              </Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12, paddingRight: 16 }}
          >
            {recents.length === 0 ? (
              <Card
                pressable
                onPress={() => navigation.navigate('FavoritesRecents')}
                className="w-40"
              >
                <View className="mb-2 flex-row items-center justify-between">
                  <Ionicons name="time-outline" size={18} color="#94a3b8" />
                  <Text className="text-xs text-text-tertiary dark:text-slate-500">
                    Today
                  </Text>
                </View>
                <Text
                  className="mb-1 font-sans-medium text-text dark:text-slate-100"
                  numberOfLines={2}
                >
                  No recent meals
                </Text>
                <Text className="text-sm text-text-secondary dark:text-slate-400">
                  Tap to add
                </Text>
              </Card>
            ) : (
              recents.slice(0, 5).map((item) => (
                <Card
                  key={item.foodId}
                  pressable
                  onPress={() => navigation.navigate('TextSearch')}
                  className="w-40"
                >
                  <View className="mb-2 flex-row items-center justify-between">
                    <Ionicons name="time-outline" size={18} color="#94a3b8" />
                  </View>
                  <Text
                    className="mb-1 font-sans-medium text-text dark:text-slate-100"
                    numberOfLines={2}
                  >
                    {item.name}
                  </Text>
                  <Text className="text-sm text-text-secondary dark:text-slate-400">
                    {item.lastCalories} cal
                  </Text>
                </Card>
              ))
            )}
          </ScrollView>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
