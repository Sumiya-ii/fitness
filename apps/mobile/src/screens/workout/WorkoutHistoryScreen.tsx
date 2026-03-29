import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
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
import { BackButton, SkeletonLoader } from '../../components/ui';
import { useWorkoutStore } from '../../stores/workout.store';
import { useLocale } from '../../i18n';
import { useColors } from '../../theme';
import type { MainStackParamList } from '../../navigation/types';
import type { WorkoutLog } from '../../api/workouts';

type Nav = NativeStackNavigationProp<MainStackParamList>;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const PERIOD_OPTIONS = [
  { key: 7, labelKey: 'workout.period7d' },
  { key: 30, labelKey: 'workout.period30d' },
  { key: 90, labelKey: 'workout.period90d' },
] as const;

function formatDate(iso: string, t: (key: string) => string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);

  if (diff === 0) return t('workout.today');
  if (diff === 1) return t('workout.yesterday');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function WorkoutHistoryScreen() {
  const navigation = useNavigation<Nav>();
  const { t, locale } = useLocale();
  const c = useColors();
  const {
    history,
    historyMeta,
    historyLoading,
    fetchHistory,
    summary,
    fetchSummary,
    summaryLoading: _summaryLoading,
  } = useWorkoutStore();
  const [days, setDays] = useState(30);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchHistory({ days, page: 1 });
      fetchSummary();
    }, [days, fetchHistory, fetchSummary]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchHistory({ days, page: 1 }), fetchSummary()]);
    setRefreshing(false);
  };

  const loadMore = () => {
    if (historyMeta && history.length < historyMeta.total) {
      fetchHistory({ days, page: (historyMeta.page ?? 0) + 1 });
    }
  };

  const label = (l: { en: string; mn: string } | null) =>
    l ? (locale === 'mn' ? l.mn : l.en) : '';

  // Group workouts by date
  const grouped = history.reduce<Record<string, WorkoutLog[]>>((acc, w) => {
    const key = w.loggedAt.split('T')[0];
    (acc[key] ??= []).push(w);
    return acc;
  }, {});

  const dateKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <View className="flex-1 bg-surface-app">
      <SafeAreaView edges={['top']} className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-5 pt-3 pb-2">
          <BackButton />
          <Text className="ml-3 text-xl font-sans-bold text-text-DEFAULT">
            {t('workout.history')}
          </Text>
        </View>

        {/* Summary banner */}
        {summary && (
          <Animated.View entering={FadeInDown.duration(250)} className="mx-5 mt-2 mb-3">
            <View className="bg-primary-500 rounded-3xl p-4 flex-row items-center">
              <View className="flex-1 flex-row">
                <MiniStat value={String(summary.workoutCount)} label={t('workout.workouts')} />
                <MiniStat value={`${summary.totalDurationMin}m`} label={t('workout.time')} />
                <MiniStat value={String(summary.totalCaloriesBurned)} label="kcal" />
                <MiniStat value={`${summary.activeDays}/7`} label={t('workout.days')} />
              </View>
            </View>
          </Animated.View>
        )}

        {/* Period selector */}
        <View className="flex-row mx-5 gap-2 mb-3">
          {PERIOD_OPTIONS.map((opt) => (
            <Pressable
              key={opt.key}
              onPress={() => {
                Haptics.selectionAsync();
                setDays(opt.key);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: days === opt.key }}
              accessibilityLabel={t(opt.labelKey)}
              className={`rounded-full px-4 py-2 min-h-[36px] items-center justify-center ${
                days === opt.key
                  ? 'bg-primary-500'
                  : 'bg-surface-default border border-surface-border'
              }`}
            >
              <Text
                className={`text-sm font-sans-medium ${
                  days === opt.key ? 'text-on-primary' : 'text-text-secondary'
                }`}
              >
                {t(opt.labelKey)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* History list */}
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
          onMomentumScrollEnd={({ nativeEvent }) => {
            const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
            if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 100) {
              loadMore();
            }
          }}
        >
          {historyLoading && history.length === 0 ? (
            <View className="mx-5 gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <View
                  key={`sk-${i}`}
                  className="bg-surface-default rounded-2xl p-4 flex-row items-center gap-3 border border-surface-border"
                >
                  <SkeletonLoader variant="rect" width={44} height={44} borderRadius={12} />
                  <View className="flex-1 gap-2">
                    <SkeletonLoader width="50%" height={14} borderRadius={7} />
                    <SkeletonLoader width="35%" height={11} borderRadius={5} />
                  </View>
                </View>
              ))}
            </View>
          ) : history.length === 0 ? (
            <View className="mx-5 mt-10 items-center">
              <View className="h-20 w-20 rounded-full bg-surface-default border border-surface-border items-center justify-center mb-4">
                <Ionicons name="barbell-outline" size={36} color={c.textTertiary} />
              </View>
              <Text className="text-base font-sans-semibold text-text-secondary mt-1 leading-6">
                {t('workout.noHistory')}
              </Text>
              <Text className="text-sm text-text-tertiary mt-1 text-center leading-5">
                {t('workout.noHistoryDesc')}
              </Text>
            </View>
          ) : (
            dateKeys.map((dateKey, dateIdx) => (
              <Animated.View
                key={dateKey}
                entering={FadeInDown.delay(Math.min(dateIdx * 30, 150)).duration(250)}
                className="mx-5 mb-5"
              >
                <Text className="text-xs font-sans-bold text-text-tertiary uppercase tracking-wider mb-2.5 leading-4">
                  {formatDate(grouped[dateKey]![0].loggedAt, t)}
                </Text>
                <View className="gap-2">
                  {grouped[dateKey]!.map((workout) => (
                    <HistoryRow
                      key={workout.id}
                      workout={workout}
                      label={label(workout.label) || workout.workoutType.replace(/_/g, ' ')}
                      onPress={() => navigation.navigate('WorkoutDetail', { id: workout.id })}
                    />
                  ))}
                </View>
              </Animated.View>
            ))
          )}

          {historyLoading && history.length > 0 && (
            <View className="items-center py-4">
              <ActivityIndicator size="small" color={c.textTertiary} />
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* ── Mini Stat ─────────────────────────────────────────────────────────────── */

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <View className="flex-1 items-center">
      <Text className="text-base font-sans-bold text-on-primary leading-6">{value}</Text>
      <Text className="text-[10px] font-sans-medium text-on-primary/70 mt-0.5 leading-3">
        {label}
      </Text>
    </View>
  );
}

/* ── History Row ───────────────────────────────────────────────────────────── */

function HistoryRow({
  workout,
  label,
  onPress,
}: {
  workout: WorkoutLog;
  label: string;
  onPress: () => void;
}) {
  const c = useColors();
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
        scale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 400 });
      }}
      style={animatedStyle}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="bg-surface-default rounded-2xl flex-row items-center px-4 py-3.5 border border-surface-border min-h-[56px]"
    >
      <View className="h-11 w-11 rounded-xl bg-surface-secondary items-center justify-center mr-3">
        <Text className="text-xl">{workout.icon ?? '🏋️'}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-sm font-sans-semibold text-text-DEFAULT leading-5">{label}</Text>
        <View className="flex-row items-center mt-0.5">
          {workout.durationMin != null && (
            <Text className="text-xs text-text-tertiary font-sans leading-4">
              {workout.durationMin} min
            </Text>
          )}
          {workout.durationMin != null && workout.calorieBurned != null && (
            <Text className="text-xs text-text-tertiary font-sans mx-1 leading-4">·</Text>
          )}
          {workout.calorieBurned != null && (
            <Text className="text-xs text-text-tertiary font-sans leading-4">
              {workout.calorieBurned} kcal
            </Text>
          )}
          <Text className="text-xs text-text-tertiary font-sans ml-2 leading-4">
            {formatTime(workout.loggedAt)}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.textTertiary} />
    </AnimatedPressable>
  );
}
