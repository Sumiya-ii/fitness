import { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { mealsApi, type RecentItem } from '../api/meals';
import type { LogStackParamList } from '../navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useLocale } from '../i18n';

type NavProp = NativeStackNavigationProp<LogStackParamList, 'LogHome'>;

interface ActionItem {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  gradient: [string, string];
  route: keyof LogStackParamList;
}

const ACTION_ITEMS: ActionItem[] = [
  {
    id: 'text-search',
    title: 'Search',
    subtitle: 'Find foods',
    icon: 'search',
    gradient: ['#1f2028', '#15161d'],
    route: 'TextSearch',
  },
  {
    id: 'barcode',
    title: 'Barcode',
    subtitle: 'Scan label',
    icon: 'barcode-outline',
    gradient: ['#8f93a4', '#797d90'],
    route: 'BarcodeScan',
  },
  {
    id: 'voice',
    title: 'Voice',
    subtitle: 'Speak it',
    icon: 'mic',
    gradient: ['#8b8fa0', '#767b8f'],
    route: 'VoiceLog',
  },
  {
    id: 'quick-add',
    title: 'Quick Add',
    subtitle: 'Manual entry',
    icon: 'flash',
    gradient: ['#8f93a4', '#db2777'],
    route: 'QuickAdd',
  },
];

export function LogScreen() {
  const navigation = useNavigation<NavProp>();
  const { t } = useLocale();
  const [recents, setRecents] = useState<RecentItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      mealsApi.getRecents(10).then((res) => setRecents(res.data)).catch(() => {});
    }, [])
  );

  return (
    <View className="flex-1 bg-surface-app">
      <SafeAreaView edges={['top']} className="flex-1">
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {/* Header */}
          <View className="px-5 pt-2 pb-4">
            <Text className="text-2xl font-sans-bold text-text">
              {t('logging.logMeal')}
            </Text>
            <Text className="text-sm text-text-secondary font-sans-medium mt-1">
              {t('logging.chooseHow')}
            </Text>
          </View>

          {/* AI Scan Hero Card */}
          <Animated.View entering={FadeInDown.duration(400)} className="px-4 mb-4">
            <Pressable
              onPress={() => navigation.navigate('PhotoLog')}
              className="overflow-hidden rounded-3xl"
            >
              <LinearGradient
                colors={['#7c3aed', '#4f46e5', '#6d28d9']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="p-5"
              >
                <View className="flex-row items-center">
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2 mb-2">
                      <View className="h-6 w-6 rounded-full bg-white/20 items-center justify-center">
                        <Ionicons name="sparkles" size={14} color="#ffffff" />
                      </View>
                      <Text className="text-xs font-sans-semibold text-text-secondary uppercase tracking-wider">
                        AI Powered
                      </Text>
                    </View>
                    <Text className="text-xl font-sans-bold text-text mb-1">
                      Snap & Track
                    </Text>
                    <Text className="text-sm text-text-secondary font-sans-medium">
                      Take a photo and let AI estimate calories and macros instantly
                    </Text>
                  </View>
                  <View className="h-16 w-16 rounded-2xl bg-white/15 items-center justify-center ml-4">
                    <Ionicons name="camera" size={32} color="#ffffff" />
                  </View>
                </View>
              </LinearGradient>
            </Pressable>
          </Animated.View>

          {/* Action Grid */}
          <View className="px-4 mb-6">
            <View className="flex-row flex-wrap gap-3">
              {ACTION_ITEMS.map((action, index) => (
                <Animated.View
                  key={action.id}
                  entering={FadeInDown.delay(100 + index * 60).duration(400)}
                  className="flex-1 min-w-[45%]"
                >
                  <Pressable
                    onPress={() => navigation.navigate(action.route as never)}
                    className="rounded-2xl bg-surface-card border border-surface-border p-4"
                  >
                    <LinearGradient
                      colors={action.gradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      className="h-11 w-11 rounded-xl items-center justify-center mb-3"
                    >
                      <Ionicons name={action.icon} size={22} color="#ffffff" />
                    </LinearGradient>
                    <Text className="font-sans-semibold text-text text-base">
                      {action.title}
                    </Text>
                    <Text className="text-xs text-text-secondary font-sans-medium mt-0.5">
                      {action.subtitle}
                    </Text>
                  </Pressable>
                </Animated.View>
              ))}
            </View>
          </View>

          {/* Favorites & Recents */}
          <View className="px-4">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-sans-semibold text-text">
                {t('logging.recentMeals')}
              </Text>
              <Pressable onPress={() => navigation.navigate('FavoritesRecents')}>
                <Text className="text-sm font-sans-medium text-primary-400">
                  {t('common.seeAll')}
                </Text>
              </Pressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingRight: 16 }}
            >
              {recents.length === 0 ? (
                <Animated.View entering={FadeInRight.duration(400)}>
                  <Pressable
                    onPress={() => navigation.navigate('FavoritesRecents')}
                    className="w-44 rounded-2xl bg-surface-card border border-surface-border p-4"
                  >
                    <View className="h-10 w-10 rounded-full bg-surface-secondary items-center justify-center mb-3">
                      <Ionicons name="time-outline" size={20} color="#9a9caa" />
                    </View>
                    <Text className="font-sans-medium text-text mb-1">
                      No recent meals
                    </Text>
                    <Text className="text-xs text-text-secondary">
                      Your logged meals will appear here
                    </Text>
                  </Pressable>
                </Animated.View>
              ) : (
                recents.slice(0, 6).map((item, index) => (
                  <Animated.View
                    key={item.foodId}
                    entering={FadeInRight.delay(60 * index).duration(400)}
                  >
                    <Pressable
                      onPress={() => navigation.navigate('TextSearch')}
                      className="w-44 rounded-2xl bg-surface-card border border-surface-border p-4"
                    >
                      <View className="flex-row items-center justify-between mb-3">
                        <View className="h-8 w-8 rounded-full bg-primary-500/20 items-center justify-center">
                          <Ionicons name="nutrition" size={16} color="#1f2028" />
                        </View>
                        <Pressable className="h-7 w-7 rounded-full bg-surface-secondary items-center justify-center">
                          <Ionicons name="add" size={16} color="#9a9caa" />
                        </Pressable>
                      </View>
                      <Text
                        className="font-sans-medium text-text mb-1"
                        numberOfLines={2}
                      >
                        {item.name}
                      </Text>
                      <Text className="text-xs text-text-secondary font-sans-medium">
                        {item.lastCalories} kcal
                      </Text>
                    </Pressable>
                  </Animated.View>
                ))
              )}
            </ScrollView>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
