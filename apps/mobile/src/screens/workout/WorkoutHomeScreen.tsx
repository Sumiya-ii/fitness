import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { BackButton, Card, SkeletonLoader } from '../../components/ui';
import { useWorkoutStore } from '../../stores/workout.store';
import { useLocale } from '../../i18n';
import { useColors } from '../../theme';
import type { MainStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const CATEGORY_META = [
  { key: 'cardio', icon: '🏃' },
  { key: 'strength', icon: '🏋️' },
  { key: 'hiit', icon: '🔥' },
  { key: 'sports', icon: '⚽' },
  { key: 'flexibility', icon: '🧘' },
];

export function WorkoutHomeScreen() {
  const navigation = useNavigation<Nav>();
  const { t, locale } = useLocale();
  const c = useColors();
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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigation.navigate('WorkoutActive', { workoutType: activeWorkoutType });
    }
  };

  const quickLog = (workoutType: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('WorkoutActive', { workoutType });
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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={c.textTertiary}
            />
          }
        >
          {/* Active Workout Banner */}
          {activeWorkoutType && (
            <Animated.View entering={FadeInDown.duration(300)} className="mx-5 mt-3">
              <Pressable
                onPress={continueWorkout}
                accessibilityRole="button"
                accessibilityLabel={t('workout.tapToContinue')}
                className="bg-success rounded-3xl p-4 flex-row items-center active:opacity-90"
              >
                <View className="h-12 w-12 rounded-2xl bg-white/20 items-center justify-center mr-3">
                  <Ionicons name="timer-outline" size={24} color="#ffffff" />
                </View>
                <View className="flex-1">
                  <Text className="text-white font-sans-bold text-base leading-6">
                    {t('workout.inProgress')}
                  </Text>
                  <Text className="text-white/70 font-sans text-sm leading-5 mt-0.5">
                    {t('workout.tapToContinue')}
                  </Text>
                </View>
                <View className="h-8 w-8 rounded-full bg-white/20 items-center justify-center">
                  <Ionicons name="chevron-forward" size={16} color="#ffffff" />
                </View>
              </Pressable>
            </Animated.View>
          )}

          {/* Start Workout CTA */}
          <Animated.View entering={FadeInDown.duration(300)} className="mx-5 mt-4">
            <StartWorkoutButton
              onPress={startNewWorkout}
              label={t('workout.startWorkout')}
              subtitle={t('workout.startDesc')}
            />
          </Animated.View>

          {/* Weekly Summary Card */}
          <Animated.View entering={FadeInDown.delay(60).duration(300)} className="mx-5 mt-6">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-base font-sans-bold text-text-DEFAULT">
                {t('workout.thisWeek')}
              </Text>
              <Pressable
                onPress={() => navigation.navigate('WorkoutHistory')}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('common.seeAll')}
              >
                <Text className="text-sm font-sans-medium text-primary-500">
                  {t('common.seeAll')}
                </Text>
              </Pressable>
            </View>

            {summaryLoading && !summary ? (
              <View className="bg-surface-default rounded-3xl p-5 border border-surface-border">
                <View className="flex-row gap-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <View key={`sum-sk-${i}`} className="flex-1 items-center gap-2">
                      <SkeletonLoader variant="circle" width={36} />
                      <SkeletonLoader width="70%" height={14} borderRadius={7} />
                      <SkeletonLoader width="50%" height={10} borderRadius={5} />
                    </View>
                  ))}
                </View>
              </View>
            ) : summary ? (
              <View className="bg-surface-default rounded-3xl p-5 border border-surface-border">
                <View className="flex-row">
                  <SummaryItem
                    icon="flame-outline"
                    value={String(summary.totalCaloriesBurned)}
                    label={t('workout.kcalBurned')}
                    iconColor={c.warning}
                  />
                  <SummaryItem
                    icon="barbell-outline"
                    value={String(summary.workoutCount)}
                    label={t('workout.workouts')}
                    iconColor={c.primary}
                  />
                  <SummaryItem
                    icon="time-outline"
                    value={`${summary.totalDurationMin}`}
                    label={t('workout.minutes')}
                    iconColor={c.success}
                  />
                  <SummaryItem
                    icon="calendar-outline"
                    value={`${summary.activeDays}/7`}
                    label={t('workout.days')}
                    iconColor={c.textSecondary}
                  />
                </View>

                {/* Type breakdown pills */}
                {Object.keys(summary.byType).length > 0 && (
                  <View className="flex-row flex-wrap gap-2 mt-4 pt-4 border-t border-surface-border">
                    {Object.entries(summary.byType).map(([type, count]) => (
                      <View
                        key={type}
                        className="bg-surface-secondary rounded-full px-3 py-1 flex-row items-center"
                      >
                        <Text className="text-xs font-sans-medium text-text-secondary">
                          {type.replace(/_/g, ' ')} x{count as number}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <View className="bg-surface-default rounded-3xl p-6 items-center border border-surface-border">
                <Ionicons name="barbell-outline" size={32} color={c.textTertiary} />
                <Text className="text-sm font-sans-medium text-text-tertiary mt-3">
                  {t('workout.noWorkoutsYet')}
                </Text>
              </View>
            )}
          </Animated.View>

          {/* Recent Workouts -- Quick Re-log */}
          <Animated.View entering={FadeInDown.delay(120).duration(300)} className="mx-5 mt-6">
            <Text className="text-base font-sans-bold text-text-DEFAULT mb-3">
              {t('workout.recentTypes')}
            </Text>

            {recentsLoading && recents.length === 0 ? (
              <View className="gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <View
                    key={`rec-sk-${i}`}
                    className="bg-surface-default rounded-2xl p-4 flex-row items-center gap-3 border border-surface-border"
                  >
                    <SkeletonLoader variant="rect" width={44} height={44} borderRadius={12} />
                    <View className="flex-1 gap-2">
                      <SkeletonLoader width="55%" height={14} borderRadius={7} />
                      <SkeletonLoader width="35%" height={11} borderRadius={5} />
                    </View>
                  </View>
                ))}
              </View>
            ) : recents.length === 0 ? (
              <View className="bg-surface-default rounded-3xl p-6 items-center border border-surface-border">
                <Ionicons name="time-outline" size={32} color={c.textTertiary} />
                <Text className="text-sm font-sans-medium text-text-tertiary mt-3">
                  {t('workout.noRecents')}
                </Text>
                <Text className="text-xs text-text-tertiary mt-1 text-center leading-4">
                  {t('workout.noRecentsDesc')}
                </Text>
              </View>
            ) : (
              <View className="gap-3">
                {recents.map((item, index) => (
                  <Animated.View
                    key={`${item.id}-${index}`}
                    entering={FadeInDown.delay(140 + index * 35).duration(250)}
                  >
                    <Card pressable onPress={() => quickLog(item.workoutType)}>
                      <View className="flex-row items-center">
                        <View className="h-11 w-11 rounded-xl bg-surface-secondary items-center justify-center mr-3">
                          <Text className="text-xl">{item.icon ?? '🏋️'}</Text>
                        </View>
                        <View className="flex-1 mr-3">
                          <Text
                            className="text-sm font-sans-semibold text-text-DEFAULT leading-5"
                            numberOfLines={1}
                          >
                            {label(item.label) || item.workoutType.replace(/_/g, ' ')}
                          </Text>
                          <Text className="text-xs text-text-tertiary font-sans mt-0.5 leading-4">
                            {item.durationMin ? `${item.durationMin} min` : ''}
                            {item.durationMin && item.calorieBurned ? ' · ' : ''}
                            {item.calorieBurned ? `${item.calorieBurned} kcal` : ''}
                          </Text>
                        </View>
                        <View
                          className="h-9 w-9 rounded-full bg-primary-500 items-center justify-center"
                          accessibilityLabel={t('workout.startWorkout')}
                        >
                          <Ionicons name="play" size={14} color={c.onPrimary} />
                        </View>
                      </View>
                    </Card>
                  </Animated.View>
                ))}
              </View>
            )}
          </Animated.View>

          {/* Browse by Category */}
          <Animated.View entering={FadeInDown.delay(180).duration(300)} className="mx-5 mt-6">
            <Text className="text-base font-sans-bold text-text-DEFAULT mb-3">
              {t('workout.categories')}
            </Text>
            <View className="flex-row flex-wrap" style={{ gap: 12 }}>
              {CATEGORY_META.map((cat) => (
                <CategoryCard
                  key={cat.key}
                  icon={cat.icon}
                  label={t(`workout.cat.${cat.key}`)}
                  onPress={() => navigation.navigate('WorkoutTypePicker', { category: cat.key })}
                />
              ))}
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* ── Start Workout Button ──────────────────────────────────────────────────── */

function StartWorkoutButton({
  onPress,
  label,
  subtitle,
}: {
  onPress: () => void;
  label: string;
  subtitle: string;
}) {
  const c = useColors();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.97, { damping: 15, stiffness: 400 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 400 });
      }}
      style={animatedStyle}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="bg-primary-500 rounded-3xl p-6 items-center"
    >
      <View className="h-14 w-14 rounded-full bg-on-primary/15 items-center justify-center mb-3">
        <Ionicons name="add" size={32} color={c.onPrimary} />
      </View>
      <Text className="text-on-primary font-sans-bold text-lg leading-7">{label}</Text>
      <Text className="text-on-primary/60 font-sans text-sm leading-5 mt-1">{subtitle}</Text>
    </AnimatedPressable>
  );
}

/* ── Summary Item ──────────────────────────────────────────────────────────── */

function SummaryItem({
  icon,
  value,
  label,
  iconColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  iconColor: string;
}) {
  return (
    <View className="flex-1 items-center">
      <View className="h-9 w-9 rounded-full bg-surface-secondary items-center justify-center mb-1.5">
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text className="text-lg font-sans-bold text-text-DEFAULT leading-6">{value}</Text>
      <Text className="text-[10px] font-sans-medium text-text-tertiary mt-0.5 text-center leading-3">
        {label}
      </Text>
    </View>
  );
}

/* ── Category Card ─────────────────────────────────────────────────────────── */

function CategoryCard({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      onPressIn={() => {
        scale.value = withSpring(0.95, { damping: 15, stiffness: 400 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 400 });
      }}
      style={[animatedStyle, { width: '47%' } as never]}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="bg-surface-default rounded-2xl p-4 items-center border border-surface-border"
    >
      <Text className="text-2xl mb-1.5">{icon}</Text>
      <Text className="text-sm font-sans-semibold text-text-DEFAULT text-center leading-5">
        {label}
      </Text>
    </AnimatedPressable>
  );
}
