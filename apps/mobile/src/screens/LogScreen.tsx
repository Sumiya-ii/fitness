import { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { SkeletonLoader } from '../components/ui';
import { mealsApi, type RecentItem } from '../api/meals';
import type { LogStackParamList } from '../navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../navigation/types';
import { useLocale } from '../i18n';
import { useProGate } from '../hooks/useProGate';
import { useColors } from '../theme';
import { features } from '../config/features';

type NavProp = NativeStackNavigationProp<LogStackParamList, 'LogHome'>;

export function LogScreen() {
  const navigation = useNavigation<NavProp>();
  const { t } = useLocale();
  const c = useColors();
  const [recents, setRecents] = useState<RecentItem[]>([]);
  const [loadingRecents, setLoadingRecents] = useState(true);
  const [loggingId, setLoggingId] = useState<string | null>(null);
  const { requirePro } = useProGate();

  useFocusEffect(
    useCallback(() => {
      setLoadingRecents(true);
      mealsApi
        .getRecents(15)
        .then((res) => setRecents(res.data))
        .catch(() => setRecents([]))
        .finally(() => setLoadingRecents(false));
    }, []),
  );

  const handleAction = async (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    switch (key) {
      case 'camera':
        if (!(await requirePro())) return;
        return navigation.navigate('PhotoLog');
      case 'voice':
        if (!(await requirePro())) return;
        return navigation.navigate('VoiceLog');
      case 'barcode':
        return navigation.navigate('BarcodeScan');
      case 'quick':
        return navigation.navigate('QuickAdd');
    }
  };

  const relogItem = async (item: RecentItem) => {
    if (loggingId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoggingId(item.foodId);
    try {
      const hour = new Date().getHours();
      const mealType =
        hour < 10 ? 'breakfast' : hour < 14 ? 'lunch' : hour < 17 ? 'snack' : 'dinner';
      await mealsApi.quickAdd({
        mealType,
        calories: item.lastCalories,
        proteinGrams: item.lastProtein ?? 0,
        note: item.name,
        source: 'quick_relog',
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      mealsApi
        .getRecents(15)
        .then((res) => setRecents(res.data))
        .catch(() => {});
    } catch {
      Alert.alert(t('common.error'), t('logging.couldNotLog'));
    } finally {
      setLoggingId(null);
    }
  };

  const actions = [
    {
      key: 'camera',
      icon: 'camera' as const,
      labelKey: 'logging.photo' as const,
      color: c.text,
    },
    ...(features.voiceLoggingInApp
      ? [
          {
            key: 'voice',
            icon: 'mic' as const,
            labelKey: 'logging.voice' as const,
            color: c.warning,
          },
        ]
      : []),
    {
      key: 'barcode',
      icon: 'barcode-outline' as const,
      labelKey: 'logging.scan' as const,
      color: c.success,
    },
    {
      key: 'quick',
      icon: 'flash' as const,
      labelKey: 'logging.quick' as const,
      color: c.primaryMuted,
    },
  ];

  return (
    <View className="flex-1 bg-surface-app">
      <SafeAreaView edges={['top']} className="flex-1">
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View className="px-5 pt-3 pb-1">
            <Text className="text-2xl font-sans-bold text-text">{t('logging.logMeal')}</Text>
          </View>

          {/* Search bar */}
          <Animated.View entering={FadeInDown.duration(300)} className="mx-5 mt-3 mb-5">
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate('TextSearch');
              }}
              className="rounded-2xl flex-row items-center px-4 py-3.5 border border-surface-border bg-surface-card"
              accessibilityRole="button"
              accessibilityLabel={t('logging.findFoods')}
            >
              <Ionicons name="search" size={20} color={c.textTertiary} />
              <Text className="flex-1 ml-3 text-base text-text-tertiary font-sans">
                {t('logging.findFoods')}
              </Text>
              <View className="h-7 px-2.5 rounded-lg items-center justify-center bg-surface-secondary">
                <Text className="text-xs font-sans-medium text-text-tertiary">
                  {t('logging.textSearch')}
                </Text>
              </View>
            </Pressable>
          </Animated.View>

          {/* Action strip */}
          <Animated.View
            entering={FadeInDown.delay(60).duration(300)}
            className="flex-row mx-5 mb-6 gap-3"
          >
            {actions.map((action) => (
              <Pressable
                key={action.key}
                onPress={() => void handleAction(action.key)}
                className="flex-1 items-center py-3 rounded-2xl bg-surface-card border border-surface-border"
                accessibilityRole="button"
                accessibilityLabel={t(action.labelKey)}
              >
                <View className="h-11 w-11 rounded-xl items-center justify-center mb-1.5 bg-surface-secondary">
                  <Ionicons name={action.icon} size={22} color={action.color} />
                </View>
                <Text className="text-xs font-sans-semibold text-text">{t(action.labelKey)}</Text>
              </Pressable>
            ))}
          </Animated.View>

          {/* Workout logging */}
          {features.workouts && (
            <Animated.View entering={FadeInDown.delay(90).duration(300)} className="mx-5 mb-5">
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation
                    .getParent<NativeStackNavigationProp<MainStackParamList>>()
                    ?.navigate('WorkoutHome');
                }}
                className="bg-surface-card rounded-2xl flex-row items-center px-4 py-3.5"
                accessibilityRole="button"
                accessibilityLabel={t('workout.logWorkout')}
              >
                <View className="h-10 w-10 rounded-xl bg-surface-secondary items-center justify-center mr-3">
                  <Ionicons name="barbell-outline" size={22} color={c.text} />
                </View>
                <View className="flex-1">
                  <Text className="text-text font-sans-semibold text-sm">
                    {t('workout.logWorkout')}
                  </Text>
                  <Text className="text-text-tertiary font-sans text-xs mt-0.5">
                    {t('workout.logWorkoutDesc')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={c.textTertiary} />
              </Pressable>
            </Animated.View>
          )}

          {/* Quick access row */}
          <Animated.View
            entering={FadeInDown.delay(120).duration(300)}
            className="flex-row mx-5 mb-6 gap-3"
          >
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate('MealTemplates');
              }}
              className="flex-1 rounded-2xl flex-row items-center px-4 py-3 border border-surface-border bg-surface-card"
              accessibilityRole="button"
              accessibilityLabel={t('logging.myMeals')}
            >
              <Ionicons name="bookmark-outline" size={18} color={c.textSecondary} />
              <Text className="ml-2.5 text-sm font-sans-medium text-text-secondary">
                {t('logging.myMeals')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate('FavoritesRecents');
              }}
              className="flex-1 rounded-2xl flex-row items-center px-4 py-3 border border-surface-border bg-surface-card"
              accessibilityRole="button"
              accessibilityLabel={t('logging.favorites')}
            >
              <Ionicons name="heart-outline" size={18} color={c.textSecondary} />
              <Text className="ml-2.5 text-sm font-sans-medium text-text-secondary">
                {t('logging.favorites')}
              </Text>
            </Pressable>
          </Animated.View>

          {/* Recently Logged */}
          <Animated.View entering={FadeInDown.delay(180).duration(300)} className="px-5">
            <Text className="text-base font-sans-bold text-text mb-3">
              {t('logging.recentMeals')}
            </Text>

            {loadingRecents ? (
              <View className="gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <View
                    key={`sk-${i}`}
                    className="rounded-2xl p-3.5 flex-row items-center gap-3 border border-surface-border bg-surface-card"
                  >
                    <SkeletonLoader variant="rect" width={40} height={40} borderRadius={12} />
                    <View className="flex-1 gap-2">
                      <SkeletonLoader width="65%" height={13} borderRadius={6} />
                      <SkeletonLoader width="35%" height={11} borderRadius={6} />
                    </View>
                  </View>
                ))}
              </View>
            ) : recents.length === 0 ? (
              <View className="rounded-2xl p-6 items-center border border-surface-border bg-surface-card">
                <Ionicons name="time-outline" size={28} color={c.textTertiary} />
                <Text className="text-sm font-sans-medium text-text-tertiary mt-2">
                  {t('logging.noRecents')}
                </Text>
              </View>
            ) : (
              <View className="gap-2">
                {recents.slice(0, 8).map((item, index) => {
                  const isLogging = loggingId === item.foodId;
                  return (
                    <Animated.View
                      key={`${item.foodId}-${index}`}
                      entering={FadeInDown.delay(200 + index * 30).duration(250)}
                    >
                      <Pressable
                        onPress={() => relogItem(item)}
                        disabled={isLogging}
                        className="rounded-2xl flex-row items-center px-4 py-3 border border-surface-border bg-surface-card"
                        style={isLogging ? { opacity: 0.5 } : undefined}
                        accessibilityRole="button"
                        accessibilityLabel={`${item.name}, ${item.lastCalories} kcal`}
                      >
                        {/* Calories badge */}
                        <View className="h-10 w-10 rounded-xl bg-surface-secondary items-center justify-center mr-3">
                          <Text className="text-xs font-sans-bold text-text-secondary">
                            {item.lastCalories}
                          </Text>
                        </View>

                        {/* Name */}
                        <View className="flex-1 mr-3">
                          <Text className="text-sm font-sans-semibold text-text" numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Text className="text-xs text-text-tertiary font-sans mt-0.5">
                            {t('logging.kcalTapToLog')}
                          </Text>
                        </View>

                        {/* Add icon */}
                        <View className="h-8 w-8 rounded-full bg-surface-secondary items-center justify-center">
                          {isLogging ? (
                            <Ionicons name="hourglass-outline" size={16} color={c.text} />
                          ) : (
                            <Ionicons name="add" size={18} color={c.text} />
                          )}
                        </View>
                      </Pressable>
                    </Animated.View>
                  );
                })}
              </View>
            )}
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
