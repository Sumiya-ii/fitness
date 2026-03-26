import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { BackButton, SkeletonLoader } from '../../components/ui';
import { useWorkoutStore } from '../../stores/workout.store';
import { useLocale } from '../../i18n';
import type { MainStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

const CATEGORY_ICONS: Record<string, string> = {
  cardio: '🏃',
  strength: '🏋️',
  hiit: '🔥',
  sports: '⚽',
  flexibility: '🧘',
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  cardio: { bg: '#eff6ff', text: '#2563eb' },
  strength: { bg: '#fef3c7', text: '#d97706' },
  hiit: { bg: '#fef2f2', text: '#dc2626' },
  sports: { bg: '#f0fdf4', text: '#16a34a' },
  flexibility: { bg: '#faf5ff', text: '#7c3aed' },
};

const cardShadow = {
  shadowColor: '#0b1220',
  shadowOpacity: 0.06,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
};

export function WorkoutHomeScreen() {
  const navigation = useNavigation<Nav>();
  const { t, locale } = useLocale();
  const {
    summary,
    summaryLoading,
    recents,
    recentsLoading,
    fetchSummary,
    fetchRecents,
    activeWorkoutType,
  } = useWorkoutStore();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchSummary();
      fetchRecents();
    }, [fetchSummary, fetchRecents]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchSummary(), fetchRecents()]);
    setRefreshing(false);
  };

  const startNewWorkout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('WorkoutTypePicker');
  };

  const continueWorkout = () => {
    if (activeWorkoutType) {
      (navigation as any).navigate('WorkoutActive', { workoutType: activeWorkoutType });
    }
  };

  const quickLog = (workoutType: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    (navigation as any).navigate('WorkoutActive', { workoutType });
  };

  const label = (l: { en: string; mn: string } | null) =>
    l ? (locale === 'mn' ? l.mn : l.en) : '';

  return (
    <View className="flex-1 bg-surface-app">
      <SafeAreaView edges={['top']} className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-5 pt-3 pb-2">
          <BackButton />
          <Text className="ml-3 text-2xl font-sans-bold text-text-DEFAULT">
            {t('workout.title')}
          </Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Active Workout Banner */}
          {activeWorkoutType && (
            <Animated.View entering={FadeInDown.duration(300)} className="mx-5 mt-3">
              <Pressable
                onPress={continueWorkout}
                className="bg-primary-500 rounded-2xl p-4 flex-row items-center"
              >
                <View className="h-12 w-12 rounded-xl bg-white/20 items-center justify-center mr-3">
                  <Ionicons name="timer-outline" size={24} color="#ffffff" />
                </View>
                <View className="flex-1">
                  <Text className="text-white font-sans-bold text-base">
                    {t('workout.inProgress')}
                  </Text>
                  <Text className="text-white/70 font-sans text-sm mt-0.5">
                    {t('workout.tapToContinue')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#ffffff" />
              </Pressable>
            </Animated.View>
          )}

          {/* Start Workout Button */}
          <Animated.View entering={FadeInDown.duration(300)} className="mx-5 mt-4">
            <Pressable
              onPress={startNewWorkout}
              className="bg-primary-500 rounded-2xl p-5 items-center"
              style={cardShadow}
            >
              <View className="h-14 w-14 rounded-full bg-white/20 items-center justify-center mb-3">
                <Ionicons name="add" size={32} color="#ffffff" />
              </View>
              <Text className="text-white font-sans-bold text-lg">{t('workout.startWorkout')}</Text>
              <Text className="text-white/70 font-sans text-sm mt-1">{t('workout.startDesc')}</Text>
            </Pressable>
          </Animated.View>

          {/* Weekly Summary Card */}
          <Animated.View entering={FadeInDown.delay(60).duration(300)} className="mx-5 mt-5">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-base font-sans-bold text-text-DEFAULT">
                {t('workout.thisWeek')}
              </Text>
              <Pressable onPress={() => navigation.navigate('WorkoutHistory' as never)} hitSlop={8}>
                <Text className="text-sm font-sans-medium text-primary-500">
                  {t('common.seeAll')}
                </Text>
              </Pressable>
            </View>

            {summaryLoading && !summary ? (
              <View className="bg-white rounded-2xl p-4 border border-surface-border">
                <SkeletonLoader width="100%" height={60} borderRadius={12} />
              </View>
            ) : summary ? (
              <View
                className="bg-white rounded-2xl p-4 border border-surface-border"
                style={cardShadow}
              >
                <View className="flex-row">
                  <SummaryItem
                    icon="flame-outline"
                    value={String(summary.totalCaloriesBurned)}
                    label={t('workout.kcalBurned')}
                    color="#f97316"
                  />
                  <SummaryItem
                    icon="barbell-outline"
                    value={String(summary.workoutCount)}
                    label={t('workout.workouts')}
                    color="#3b82f6"
                  />
                  <SummaryItem
                    icon="time-outline"
                    value={`${summary.totalDurationMin}`}
                    label={t('workout.minutes')}
                    color="#8b5cf6"
                  />
                  <SummaryItem
                    icon="calendar-outline"
                    value={`${summary.activeDays}/7`}
                    label={t('workout.days')}
                    color="#16a34a"
                  />
                </View>

                {/* Type breakdown mini-pills */}
                {Object.keys(summary.byType).length > 0 && (
                  <View className="flex-row flex-wrap gap-2 mt-3 pt-3 border-t border-surface-border">
                    {Object.entries(summary.byType).map(([type, count]) => (
                      <View
                        key={type}
                        className="bg-surface-secondary rounded-full px-2.5 py-1 flex-row items-center"
                      >
                        <Text className="text-xs font-sans-medium text-text-secondary">
                          {type.replace(/_/g, ' ')} ×{count}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <View
                className="bg-white rounded-2xl p-5 items-center border border-surface-border"
                style={cardShadow}
              >
                <Ionicons name="barbell-outline" size={28} color="#c3cedf" />
                <Text className="text-sm font-sans-medium text-text-tertiary mt-2">
                  {t('workout.noWorkoutsYet')}
                </Text>
              </View>
            )}
          </Animated.View>

          {/* Recent Workouts — Quick Re-log */}
          <Animated.View entering={FadeInDown.delay(120).duration(300)} className="mx-5 mt-5">
            <Text className="text-base font-sans-bold text-text-DEFAULT mb-3">
              {t('workout.recentTypes')}
            </Text>

            {recentsLoading && recents.length === 0 ? (
              <View className="gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <View
                    key={`sk-${i}`}
                    className="bg-white rounded-2xl p-3.5 flex-row items-center gap-3 border border-surface-border"
                  >
                    <SkeletonLoader variant="rect" width={44} height={44} borderRadius={12} />
                    <View className="flex-1 gap-2">
                      <SkeletonLoader width="55%" height={13} borderRadius={6} />
                      <SkeletonLoader width="35%" height={11} borderRadius={6} />
                    </View>
                  </View>
                ))}
              </View>
            ) : recents.length === 0 ? (
              <View className="bg-white rounded-2xl p-5 items-center border border-surface-border">
                <Ionicons name="time-outline" size={28} color="#c3cedf" />
                <Text className="text-sm font-sans-medium text-text-tertiary mt-2">
                  {t('workout.noRecents')}
                </Text>
                <Text className="text-xs text-text-tertiary mt-1">
                  {t('workout.noRecentsDesc')}
                </Text>
              </View>
            ) : (
              <View className="gap-2">
                {recents.map((item, index) => {
                  return (
                    <Animated.View
                      key={`${item.id}-${index}`}
                      entering={FadeInDown.delay(140 + index * 30).duration(250)}
                    >
                      <Pressable
                        onPress={() => quickLog(item.workoutType)}
                        className="bg-white rounded-2xl flex-row items-center px-4 py-3 border border-surface-border"
                      >
                        {/* Icon */}
                        <View
                          className="h-11 w-11 rounded-xl items-center justify-center mr-3"
                          style={{ backgroundColor: '#f1f5f9' }}
                        >
                          <Text className="text-xl">{item.icon ?? '🏋️'}</Text>
                        </View>

                        {/* Details */}
                        <View className="flex-1 mr-3">
                          <Text
                            className="text-sm font-sans-semibold text-text-DEFAULT"
                            numberOfLines={1}
                          >
                            {label(item.label) || item.workoutType.replace(/_/g, ' ')}
                          </Text>
                          <Text className="text-xs text-text-tertiary font-sans mt-0.5">
                            {item.durationMin ? `${item.durationMin} min` : ''}
                            {item.durationMin && item.calorieBurned ? ' · ' : ''}
                            {item.calorieBurned ? `${item.calorieBurned} kcal` : ''}
                          </Text>
                        </View>

                        {/* Quick-start */}
                        <View className="h-9 w-9 rounded-full bg-primary-50 items-center justify-center">
                          <Ionicons name="play" size={16} color="#0f172a" />
                        </View>
                      </Pressable>
                    </Animated.View>
                  );
                })}
              </View>
            )}
          </Animated.View>

          {/* Browse by Category */}
          <Animated.View entering={FadeInDown.delay(180).duration(300)} className="mx-5 mt-5">
            <Text className="text-base font-sans-bold text-text-DEFAULT mb-3">
              {t('workout.categories')}
            </Text>
            <View className="flex-row flex-wrap gap-3">
              {Object.entries(CATEGORY_ICONS).map(([cat, icon]) => {
                const colors = CATEGORY_COLORS[cat] ?? { bg: '#f1f5f9', text: '#64748b' };
                return (
                  <Pressable
                    key={cat}
                    onPress={() => navigation.navigate('WorkoutTypePicker', { category: cat })}
                    className="rounded-2xl p-4 items-center border border-surface-border"
                    style={{ backgroundColor: colors.bg, width: '47%' }}
                  >
                    <Text className="text-2xl mb-1">{icon}</Text>
                    <Text
                      className="text-sm font-sans-semibold capitalize"
                      style={{ color: colors.text }}
                    >
                      {t(`workout.cat.${cat}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function SummaryItem({
  icon,
  value,
  label,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  color: string;
}) {
  return (
    <View className="flex-1 items-center">
      <Ionicons name={icon} size={18} color={color} />
      <Text className="text-lg font-sans-bold text-text-DEFAULT mt-1">{value}</Text>
      <Text className="text-[10px] font-sans-medium text-text-tertiary mt-0.5">{label}</Text>
    </View>
  );
}
