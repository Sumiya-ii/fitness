import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ProgressRing, SkeletonLoader } from '../components/ui';
import { api } from '../api';

interface WeeklySummaryData {
  weekStart: string;
  weekEnd: string;
  daysLogged: number;
  averageCalories: number;
  averageProtein: number;
  averageCarbs: number;
  averageFat: number;
  adherenceScore: number;
  weightStart: number | null;
  weightEnd: number | null;
  weightDelta: number | null;
}

function getMondayOfWeek(d: Date): Date {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function formatWeekRange(weekStart: string): string {
  const start = new Date(weekStart + 'T12:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

export function WeeklySummaryScreen() {
  const navigation = useNavigation();
  const [weekOffset, setWeekOffset] = useState(0);
  const [data, setData] = useState<WeeklySummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() + weekOffset * 7);
  const weekStart = getMondayOfWeek(baseDate);
  const weekStartStr = weekStart.toISOString().split('T')[0];

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: WeeklySummaryData }>(
        `/weekly-summary?week=${weekStartStr}`
      );
      setData(res.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [weekStartStr]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  if (loading && !data) {
    return <WeeklySummarySkeleton />;
  }

  const d = data ?? {
    weekStart: weekStartStr,
    weekEnd: '',
    daysLogged: 0,
    averageCalories: 0,
    averageProtein: 0,
    averageCarbs: 0,
    averageFat: 0,
    adherenceScore: 0,
    weightStart: null,
    weightEnd: null,
    weightDelta: null,
  };

  const adherenceProgress = d.adherenceScore / 100;

  return (
    <View className="flex-1 bg-surface-app">
      <SafeAreaView edges={['top']} className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-4 py-3">
          <Pressable
            onPress={() => navigation.goBack()}
            className="h-10 w-10 rounded-full bg-surface-card items-center justify-center mr-3"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={20} color="#9a9caa" />
          </Pressable>
          <Text className="flex-1 text-xl font-sans-bold text-text">
            Weekly Summary
          </Text>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Week Navigator */}
          <View className="flex-row items-center justify-center gap-4 px-4 py-4">
            <Pressable
              onPress={() => setWeekOffset((o) => o - 1)}
              className="h-10 w-10 rounded-full bg-surface-card border border-surface-border items-center justify-center"
            >
              <Ionicons name="chevron-back" size={20} color="#9a9caa" />
            </Pressable>
            <Text className="text-base font-sans-semibold text-text min-w-[160px] text-center">
              {formatWeekRange(d.weekStart)}
            </Text>
            <Pressable
              onPress={() => setWeekOffset((o) => o + 1)}
              className="h-10 w-10 rounded-full bg-surface-card border border-surface-border items-center justify-center"
            >
              <Ionicons name="chevron-forward" size={20} color="#9a9caa" />
            </Pressable>
          </View>

          {/* Adherence Ring */}
          <Animated.View
            entering={FadeInDown.duration(400)}
            className="items-center py-4"
          >
            <ProgressRing
              progress={adherenceProgress}
              size={140}
              color="#0f172a"
              gradientEnd="#1e293b"
              backgroundColor="#c3cedf"
              strokeWidth={12}
              centerLabel={`${d.adherenceScore}%`}
              centerSubLabel="adherence"
              centerCaption={`${d.daysLogged}/7 days`}
            />
          </Animated.View>

          <View className="px-4 gap-3">
            {/* Stats Grid */}
            <Animated.View
              entering={FadeInDown.delay(100).duration(400)}
              className="flex-row gap-3"
            >
              <View className="flex-1 rounded-2xl bg-surface-card border border-surface-border p-4">
                <View className="flex-row items-center gap-2 mb-2">
                  <View className="h-7 w-7 rounded-lg bg-amber-500/15 items-center justify-center">
                    <Ionicons name="flame-outline" size={14} color="#8f93a4" />
                  </View>
                  <Text className="text-xs text-text-secondary font-sans-medium">Avg Calories</Text>
                </View>
                <Text className="text-2xl font-sans-bold text-text">
                  {d.averageCalories}
                </Text>
                <Text className="text-xs text-text-tertiary">kcal/day</Text>
              </View>
              <View className="flex-1 rounded-2xl bg-surface-card border border-surface-border p-4">
                <View className="flex-row items-center gap-2 mb-2">
                  <View className="h-7 w-7 rounded-lg bg-blue-500/15 items-center justify-center">
                    <Ionicons name="fitness-outline" size={14} color="#8b8fa0" />
                  </View>
                  <Text className="text-xs text-text-secondary font-sans-medium">Avg Protein</Text>
                </View>
                <Text className="text-2xl font-sans-bold text-text">
                  {d.averageProtein}g
                </Text>
                <View className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted mt-2">
                  <View
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${Math.min(100, (d.averageProtein / 150) * 100)}%` }}
                  />
                </View>
              </View>
            </Animated.View>

            <Animated.View
              entering={FadeInDown.delay(200).duration(400)}
              className="flex-row gap-3"
            >
              <View className="flex-1 rounded-2xl bg-surface-card border border-surface-border p-4">
                <View className="flex-row items-center gap-2 mb-2">
                  <View className="h-7 w-7 rounded-lg bg-primary-500/15 items-center justify-center">
                    <Ionicons name="checkmark-circle-outline" size={14} color="#0f172a" />
                  </View>
                  <Text className="text-xs text-text-secondary font-sans-medium">Days Logged</Text>
                </View>
                <Text className="text-2xl font-sans-bold text-text">
                  {d.daysLogged}
                  <Text className="text-base text-text-secondary">/7</Text>
                </Text>
              </View>
              <View className="flex-1 rounded-2xl bg-surface-card border border-surface-border p-4">
                <View className="flex-row items-center gap-2 mb-2">
                  <View className="h-7 w-7 rounded-lg bg-accent-200 items-center justify-center">
                    <Ionicons name="scale-outline" size={14} color="#0e7490" />
                  </View>
                  <Text className="text-xs text-text-secondary font-sans-medium">Weight Change</Text>
                </View>
                {d.weightDelta !== null ? (
                  <View className="flex-row items-center gap-1">
                    <Ionicons
                      name={d.weightDelta < 0 ? 'trending-down' : d.weightDelta > 0 ? 'trending-up' : 'remove'}
                      size={20}
                      color={d.weightDelta < 0 ? '#0f172a' : d.weightDelta > 0 ? '#ea580c' : '#7687a2'}
                    />
                    <Text
                      className="text-2xl font-sans-bold"
                      style={{
                        color: d.weightDelta < 0 ? '#0f172a' : d.weightDelta > 0 ? '#ea580c' : '#7687a2',
                      }}
                    >
                      {d.weightDelta > 0 ? '+' : ''}{d.weightDelta} kg
                    </Text>
                  </View>
                ) : (
                  <Text className="text-lg text-text-tertiary">—</Text>
                )}
              </View>
            </Animated.View>

            {/* Macro Breakdown */}
            <Animated.View
              entering={FadeInDown.delay(300).duration(400)}
              className="rounded-2xl bg-surface-card border border-surface-border p-4"
            >
              <Text className="font-sans-semibold text-text mb-3">
                Daily Macro Averages
              </Text>
              <View className="gap-3">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <View className="h-3 w-3 rounded-full bg-blue-500" />
                    <Text className="text-sm text-text-secondary font-sans-medium">Protein</Text>
                  </View>
                  <Text className="text-sm font-sans-semibold text-text">{d.averageProtein}g</Text>
                </View>
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <View className="h-3 w-3 rounded-full bg-amber-500" />
                    <Text className="text-sm text-text-secondary font-sans-medium">Carbs</Text>
                  </View>
                  <Text className="text-sm font-sans-semibold text-text">{d.averageCarbs}g</Text>
                </View>
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <View className="h-3 w-3 rounded-full bg-pink-500" />
                    <Text className="text-sm text-text-secondary font-sans-medium">Fat</Text>
                  </View>
                  <Text className="text-sm font-sans-semibold text-text">{d.averageFat}g</Text>
                </View>
              </View>

              {d.weightStart != null && d.weightEnd != null && (
                <View className="mt-4 pt-3 border-t border-surface-border">
                  <Text className="text-sm text-text-secondary">
                    Weight: {d.weightStart} kg → {d.weightEnd} kg
                  </Text>
                </View>
              )}
            </Animated.View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function WeeklySummarySkeleton() {
  return (
    <View className="flex-1 bg-surface-app">
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="px-4 py-4">
          <SkeletonLoader width={180} height={28} borderRadius={10} />
        </View>
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
          <View className="px-4 py-3 flex-row justify-between items-center">
            <SkeletonLoader variant="circle" width={40} />
            <SkeletonLoader width={180} height={20} borderRadius={10} />
            <SkeletonLoader variant="circle" width={40} />
          </View>
          <View className="items-center pt-4 pb-6">
            <SkeletonLoader variant="circle" width={140} />
          </View>
          <View className="px-4">
            <View className="flex-row gap-3">
              <SkeletonLoader height={120} borderRadius={16} className="flex-1" />
              <SkeletonLoader height={120} borderRadius={16} className="flex-1" />
            </View>
            <View className="flex-row gap-3 mt-3">
              <SkeletonLoader height={120} borderRadius={16} className="flex-1" />
              <SkeletonLoader height={120} borderRadius={16} className="flex-1" />
            </View>
            <SkeletonLoader height={170} borderRadius={16} className="mt-3" />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
