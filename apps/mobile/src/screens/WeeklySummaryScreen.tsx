import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { Card, Badge, LoadingScreen } from '../components/ui';
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
  const [expanded, setExpanded] = useState(false);

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
    return <LoadingScreen />;
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
  const ringSize = 80;
  const stroke = 8;
  const r = (ringSize - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const strokeDashoffset = circumference * (1 - adherenceProgress);

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <View className="flex-row items-center px-4 py-3">
        <Pressable
          onPress={() => navigation.goBack()}
          className="mr-4 p-2"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color="#475569" />
        </Pressable>
        <Text className="flex-1 text-xl font-sans-bold text-text dark:text-slate-100">
          Weekly Summary
        </Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="flex-row items-center justify-center gap-4 px-4 py-4">
          <Pressable
            onPress={() => setWeekOffset((o) => o - 1)}
            className="rounded-full bg-slate-100 p-2 dark:bg-slate-700"
          >
            <Ionicons name="chevron-back" size={24} color="#475569" />
          </Pressable>
          <Text className="text-lg font-sans-semibold text-text dark:text-slate-100">
            {formatWeekRange(d.weekStart)}
          </Text>
          <Pressable
            onPress={() => setWeekOffset((o) => o + 1)}
            className="rounded-full bg-slate-100 p-2 dark:bg-slate-700"
          >
            <Ionicons name="chevron-forward" size={24} color="#475569" />
          </Pressable>
        </View>

        <View className="px-4 gap-4">
          <View className="flex-row flex-wrap gap-3">
            <Card className="flex-1 min-w-[140px]">
              <Text className="text-sm text-text-secondary dark:text-slate-400">
                Avg Calories
              </Text>
              <Text className="mt-1 text-2xl font-sans-bold text-text dark:text-slate-100">
                {d.averageCalories}
              </Text>
              <Text className="mt-1 text-xs text-text-secondary dark:text-slate-400">
                kcal/day
              </Text>
            </Card>
            <Card className="flex-1 min-w-[140px]">
              <Text className="text-sm text-text-secondary dark:text-slate-400">
                Avg Protein
              </Text>
              <Text className="mt-1 text-2xl font-sans-bold text-text dark:text-slate-100">
                {d.averageProtein}g
              </Text>
              <View className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <View
                  className="h-full rounded-full bg-blue-500"
                  style={{
                    width: `${Math.min(100, (d.averageProtein / 150) * 100)}%`,
                  }}
                />
              </View>
            </Card>
          </View>

          <View className="flex-row flex-wrap gap-3">
            <Card className="flex-1 min-w-[140px]">
              <Text className="text-sm text-text-secondary dark:text-slate-400">
                Days Logged
              </Text>
              <Text className="mt-1 text-2xl font-sans-bold text-text dark:text-slate-100">
                {d.daysLogged}/7
              </Text>
              <Badge variant="info" className="mt-2">
                {d.adherenceScore}% adherence
              </Badge>
            </Card>
            <Card className="flex-1 min-w-[140px]">
              <Text className="text-sm text-text-secondary dark:text-slate-400">
                Weight Change
              </Text>
              {d.weightDelta !== null ? (
                <>
                  <View className="mt-1 flex-row items-center gap-1">
                    <Ionicons
                      name={d.weightDelta < 0 ? 'trending-down' : 'trending-up'}
                      size={24}
                      color={d.weightDelta < 0 ? '#22c55e' : '#f59e0b'}
                    />
                    <Text
                      className={`text-2xl font-sans-bold ${
                        d.weightDelta < 0
                          ? 'text-primary-600 dark:text-primary-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {d.weightDelta > 0 ? '+' : ''}
                      {d.weightDelta} kg
                    </Text>
                  </View>
                </>
              ) : (
                <Text className="mt-1 text-lg text-text-secondary dark:text-slate-400">
                  —
                </Text>
              )}
            </Card>
          </View>

          <Card>
            <View className="flex-row items-center justify-between">
              <Text className="font-sans-semibold text-text dark:text-slate-100">
                Adherence Ring
              </Text>
              <View className="items-center">
                <Svg width={ringSize} height={ringSize} style={{ transform: [{ rotate: '-90deg' }] }}>
                  <Circle
                    cx={ringSize / 2}
                    cy={ringSize / 2}
                    r={r}
                    stroke="#e2e8f0"
                    strokeWidth={stroke}
                    fill="none"
                  />
                  <Circle
                    cx={ringSize / 2}
                    cy={ringSize / 2}
                    r={r}
                    stroke="#22c55e"
                    strokeWidth={stroke}
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                  />
                </Svg>
                <Text className="text-xs font-sans-medium text-text-secondary dark:text-slate-400">
                  {d.adherenceScore}%
                </Text>
              </View>
            </View>
          </Card>

          <Card pressable onPress={() => setExpanded((e) => !e)}>
            <View className="flex-row items-center justify-between">
              <Text className="font-sans-semibold text-text dark:text-slate-100">
                View Details
              </Text>
              <Ionicons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={24}
                color="#94a3b8"
              />
            </View>
            {expanded && (
              <View className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-600">
                <Text className="mb-2 font-sans-medium text-text dark:text-slate-100">
                  Daily breakdown
                </Text>
                <Text className="text-sm text-text-secondary dark:text-slate-400">
                  Avg: {d.averageCalories} kcal, {d.averageProtein}g protein,{' '}
                  {d.averageCarbs}g carbs, {d.averageFat}g fat
                </Text>
                {d.weightStart != null && d.weightEnd != null && (
                  <Text className="mt-2 text-sm text-text-secondary dark:text-slate-400">
                    Weight: {d.weightStart} kg → {d.weightEnd} kg
                  </Text>
                )}
              </View>
            )}
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
