import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Path,
  Rect,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
  Circle,
  Line,
  G,
} from 'react-native-svg';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Button, BottomSheet, Input, Badge, SkeletonLoader } from '../components/ui';
import { useWeightStore, type WeightLogEntry } from '../stores/weight.store';
import { useNutritionHistoryStore, type HistoryPeriod } from '../stores/nutrition-history.store';
import { useLocale } from '../i18n';
import { themeColors } from '../theme';
import type { DayHistory } from '../api/dashboard';

// ─── Types ────────────────────────────────────────────────────────────────────

type WeightPeriod = 'week' | 'month' | '3months';
type ProgressTab = 'nutrition' | 'body';

const PERIOD_DAYS: Record<WeightPeriod, number> = {
  week: 7,
  month: 30,
  '3months': 90,
};

const HISTORY_PERIODS: HistoryPeriod[] = [7, 30, 90];

// ─── Chart colors ─────────────────────────────────────────────────────────────

const C = {
  calories: '#0f172a',
  caloriesLight: '#c8d4e8',
  goal: '#f97316',
  protein: '#3b82f6',
  carbs: '#f59e0b',
  fat: '#ec4899',
  water: '#06b6d4',
  waterLight: '#cffafe',
};

// ─── Ghost bar helpers ────────────────────────────────────────────────────────
// Natural-looking height variations for preview bars shown to new users.
// Based on what premium apps (MyFitnessPal, Cronometer) use to show chart
// structure before any real data exists.

const GHOST_FRACTIONS = [0.78, 0.88, 0.7, 0.92, 0.82, 0.87, 0.74, 0.8, 0.68, 0.9, 0.75, 0.85, 0.72];

function ghostFrac(i: number): number {
  return GHOST_FRACTIONS[i % GHOST_FRACTIONS.length]!;
}

// ─── Data aggregation ─────────────────────────────────────────────────────────

interface ChartPoint {
  label: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  waterMl: number;
  hasData: boolean;
}

function toChartPoints(history: DayHistory[], days: HistoryPeriod): ChartPoint[] {
  if (days === 7) {
    const dayLetters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    return history.map((d) => {
      const date = new Date(d.date + 'T12:00:00');
      return {
        label: dayLetters[date.getDay()] ?? '',
        ...d,
        hasData: d.calories > 0 || d.waterMl > 0,
      };
    });
  }

  if (days === 30) {
    // Group into ISO-week buckets (Monday-based)
    const groups = new Map<string, DayHistory[]>();
    for (const d of history) {
      const date = new Date(d.date + 'T12:00:00');
      const mon = new Date(date);
      mon.setDate(date.getDate() - ((date.getDay() + 6) % 7));
      const key = mon.toISOString().split('T')[0]!;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(d);
    }
    let n = 1;
    return Array.from(groups.values()).map((days) => avgPoint(`W${n++}`, days));
  }

  // 90 days: group by calendar month
  const groups = new Map<string, DayHistory[]>();
  for (const d of history) {
    const key = d.date.substring(0, 7)!;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(d);
  }
  return Array.from(groups.entries()).map(([key, days]) => {
    const label = new Date(key + '-15T12:00:00').toLocaleDateString('en', { month: 'short' });
    return avgPoint(label, days);
  });
}

function avgPoint(label: string, days: DayHistory[]): ChartPoint {
  const n = days.length || 1;
  return {
    label,
    calories: Math.round(days.reduce((s, d) => s + d.calories, 0) / n),
    protein: Number((days.reduce((s, d) => s + d.protein, 0) / n).toFixed(1)),
    carbs: Number((days.reduce((s, d) => s + d.carbs, 0) / n).toFixed(1)),
    fat: Number((days.reduce((s, d) => s + d.fat, 0) / n).toFixed(1)),
    waterMl: Math.round(days.reduce((s, d) => s + d.waterMl, 0) / n),
    hasData: days.some((d) => d.calories > 0),
  };
}

// ─── Summary cards ────────────────────────────────────────────────────────────

function SummaryCards({
  points,
  targetCalories,
  period,
}: {
  points: ChartPoint[];
  targetCalories: number | null;
  period: HistoryPeriod;
}) {
  const logged = points.filter((p) => p.hasData);
  const avgCal =
    logged.length > 0 ? Math.round(logged.reduce((s, p) => s + p.calories, 0) / logged.length) : 0;
  const daysLogged = period === 7 ? logged.length : logged.length; // weekly/monthly buckets logged

  // Streak: consecutive hasData from the end of the 7-day array only
  let streak = 0;
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i]!.hasData) streak++;
    else break;
  }

  const goalDiff = targetCalories && avgCal > 0 ? avgCal - targetCalories : null;

  return (
    <View className="flex-row gap-2 mb-4">
      {/* Avg calories */}
      <View className="flex-1 rounded-2xl bg-surface-card border border-surface-border p-3 items-center">
        <Text className="text-[10px] text-text-tertiary font-sans-medium mb-1" numberOfLines={1}>
          Avg / day
        </Text>
        <Text className="text-lg font-sans-bold text-text">
          {avgCal > 0 ? avgCal.toLocaleString() : '–'}
        </Text>
        {goalDiff !== null && (
          <Text
            className="text-[10px] font-sans-medium mt-0.5"
            style={{ color: goalDiff <= 0 ? themeColors.status.success : C.goal }}
          >
            {goalDiff > 0 ? `+${goalDiff}` : goalDiff} kcal
          </Text>
        )}
      </View>

      {/* Days logged */}
      <View className="flex-1 rounded-2xl bg-surface-card border border-surface-border p-3 items-center">
        <Text className="text-[10px] text-text-tertiary font-sans-medium mb-1" numberOfLines={1}>
          Logged
        </Text>
        <Text className="text-lg font-sans-bold text-text">{daysLogged}</Text>
        <Text className="text-[10px] text-text-tertiary font-sans-medium mt-0.5">
          of {points.length} {period === 7 ? 'days' : 'periods'}
        </Text>
      </View>

      {/* Streak */}
      <View className="flex-1 rounded-2xl bg-surface-card border border-surface-border p-3 items-center">
        <Text className="text-[10px] text-text-tertiary font-sans-medium mb-1" numberOfLines={1}>
          Streak
        </Text>
        <View className="flex-row items-center gap-1">
          {streak > 0 && <Text style={{ fontSize: 14 }}>🔥</Text>}
          <Text className="text-lg font-sans-bold text-text">{streak}</Text>
        </View>
        <Text
          className="text-[10px] font-sans-medium mt-0.5"
          style={{ color: streak === 0 ? themeColors.status.warning : themeColors.text.tertiary }}
        >
          {streak === 0 ? 'Start today!' : streak === 1 ? 'day' : 'days'}
        </Text>
      </View>
    </View>
  );
}

// ─── Calorie bar chart ────────────────────────────────────────────────────────

function CalorieBarChart({
  points,
  targetCalories,
  chartWidth,
}: {
  points: ChartPoint[];
  targetCalories: number | null;
  chartWidth: number;
}) {
  const CHART_H = 160;
  const PAD = { top: 16, bottom: 28 };
  const plotH = CHART_H - PAD.top - PAD.bottom;

  const count = points.length;
  const gap = count > 8 ? 3 : 6;
  const barW = Math.max(4, (chartWidth - gap * (count - 1)) / count);

  const allEmpty = points.every((p) => !p.hasData);
  // When no data exists, use goal (or 2000 kcal default) as the reference scale
  const ghostBase = targetCalories ?? 2000;
  const maxVal = allEmpty
    ? ghostBase * 1.05
    : Math.max(...points.map((p) => p.calories), targetCalories ?? 0, 500);
  const scale = (v: number) => (v / (maxVal * 1.1)) * plotH;

  // Always show the goal line — even for new users it anchors expectations
  const effectiveGoal = targetCalories ?? (allEmpty ? ghostBase : null);
  const goalY = effectiveGoal ? PAD.top + plotH - scale(effectiveGoal) : null;

  return (
    <View>
      <Svg width={chartWidth} height={CHART_H}>
        <Defs>
          <SvgGradient id="calBar" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={C.calories} stopOpacity={0.9} />
            <Stop offset="100%" stopColor={C.calories} stopOpacity={0.65} />
          </SvgGradient>
        </Defs>

        {points.map((p, i) => {
          const x = i * (barW + gap);
          let h: number;
          let fill: string;
          let opacity: number;

          if (allEmpty) {
            // Ghost preview: realistic-looking bars so new users see chart shape
            h = Math.max(4, scale(ghostBase * ghostFrac(i)));
            fill = C.calories;
            opacity = 0.13;
          } else if (p.hasData) {
            h = Math.max(3, scale(p.calories));
            fill = 'url(#calBar)';
            opacity = 1;
          } else {
            // Empty day within a partially-filled period
            h = 5;
            fill = C.caloriesLight;
            opacity = 0.55;
          }

          const y = PAD.top + plotH - h;
          const rx = barW > 10 ? Math.min(6, barW / 3) : 2;
          return (
            <Rect
              key={i}
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={rx}
              fill={fill}
              fillOpacity={opacity}
            />
          );
        })}

        {/* Goal line */}
        {goalY !== null && (
          <Line
            x1={0}
            y1={goalY}
            x2={chartWidth}
            y2={goalY}
            stroke={C.goal}
            strokeWidth={1.5}
            strokeDasharray="5,4"
            strokeOpacity={0.85}
          />
        )}
      </Svg>

      {/* Goal label */}
      {goalY !== null && effectiveGoal && (
        <View
          style={{
            position: 'absolute',
            top: goalY - 9,
            right: 0,
            backgroundColor: 'rgba(249,115,22,0.1)',
            borderRadius: 4,
            paddingHorizontal: 4,
            paddingVertical: 1,
          }}
        >
          <Text style={{ fontSize: 9, color: C.goal, fontFamily: 'Inter-SemiBold' }}>
            {effectiveGoal.toLocaleString()} goal
          </Text>
        </View>
      )}

      {/* Ghost overlay pill — floats over ghost bars when no real data yet */}
      {allEmpty && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: PAD.bottom,
            justifyContent: 'center',
            alignItems: 'center',
          }}
          pointerEvents="none"
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              backgroundColor: 'rgba(255,255,255,0.92)',
              borderRadius: 20,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderWidth: 1,
              borderColor: 'rgba(15,23,42,0.08)',
            }}
          >
            <Ionicons name="sparkles-outline" size={12} color={themeColors.text.secondary} />
            <Text
              style={{
                fontSize: 11,
                fontFamily: 'Inter-SemiBold',
                color: themeColors.text.secondary,
              }}
            >
              Log meals to see your trends
            </Text>
          </View>
        </View>
      )}

      {/* X-axis labels */}
      <View className="flex-row" style={{ width: chartWidth, marginTop: 4 }}>
        {points.map((p, i) => (
          <View key={i} style={{ width: barW + (i < count - 1 ? gap : 0), alignItems: 'center' }}>
            <Text
              style={{
                fontSize: 10,
                color: themeColors.text.tertiary,
                fontFamily: 'Inter-Regular',
              }}
            >
              {p.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Macro stacked bar chart ──────────────────────────────────────────────────

function MacroStackedChart({ points, chartWidth }: { points: ChartPoint[]; chartWidth: number }) {
  const CHART_H = 110;
  const PAD = { top: 8, bottom: 4 };
  const plotH = CHART_H - PAD.top - PAD.bottom;

  const count = points.length;
  const gap = count > 8 ? 3 : 6;
  const barW = Math.max(4, (chartWidth - gap * (count - 1)) / count);

  // Scale by kcal equivalent so proportions are calorie-accurate
  const toKcal = (p: ChartPoint) => p.protein * 4 + p.carbs * 4 + p.fat * 9;
  const maxKcal = Math.max(...points.map(toKcal), 500);
  const scale = (v: number) => (v / (maxKcal * 1.1)) * plotH;

  const allEmpty = points.every((p) => !p.hasData);
  const logged = points.filter((p) => p.hasData);

  const avgProtein =
    logged.length > 0
      ? Number((logged.reduce((s, p) => s + p.protein, 0) / logged.length).toFixed(0))
      : 0;
  const avgCarbs =
    logged.length > 0
      ? Number((logged.reduce((s, p) => s + p.carbs, 0) / logged.length).toFixed(0))
      : 0;
  const avgFat =
    logged.length > 0
      ? Number((logged.reduce((s, p) => s + p.fat, 0) / logged.length).toFixed(0))
      : 0;

  // Ghost defaults: 30% protein / 45% carbs / 25% fat kcal split
  const ghostProteinG = 37.5;
  const ghostCarbsG = 112.5;
  const ghostFatG = 27.8;
  const ghostKcal = ghostProteinG * 4 + ghostCarbsG * 4 + ghostFatG * 9;
  const effectiveMaxKcal = allEmpty ? ghostKcal * 1.1 : maxKcal;
  const effectiveScale = (v: number) => (v / (effectiveMaxKcal * 1.1)) * plotH;

  return (
    <View>
      <Svg width={chartWidth} height={CHART_H}>
        {points.map((p, i) => {
          const x = i * (barW + gap);
          const baseY = PAD.top + plotH;
          const rx = barW > 10 ? Math.min(4, barW / 3) : 2;
          const frac = ghostFrac(i);

          let fatH: number, carbsH: number, proteinH: number, opacity: number;

          if (allEmpty) {
            fatH = effectiveScale(ghostFatG * 9 * frac);
            carbsH = effectiveScale(ghostCarbsG * 4 * frac);
            proteinH = effectiveScale(ghostProteinG * 4 * frac);
            opacity = 0.15;
          } else if (p.hasData) {
            fatH = effectiveScale(p.fat * 9);
            carbsH = effectiveScale(p.carbs * 4);
            proteinH = effectiveScale(p.protein * 4);
            opacity = 0.85;
          } else {
            return (
              <Rect
                key={i}
                x={x}
                y={baseY - 5}
                width={barW}
                height={5}
                rx={rx}
                fill={C.caloriesLight}
                fillOpacity={0.4}
              />
            );
          }

          const totalH = fatH + carbsH + proteinH;
          return (
            <G key={i}>
              <Rect
                x={x}
                y={baseY - proteinH}
                width={barW}
                height={proteinH}
                rx={rx}
                fill={C.protein}
                fillOpacity={opacity}
              />
              <Rect
                x={x}
                y={baseY - proteinH - carbsH}
                width={barW}
                height={carbsH}
                fill={C.carbs}
                fillOpacity={opacity}
              />
              <Rect
                x={x}
                y={baseY - totalH}
                width={barW}
                height={fatH}
                rx={rx}
                fill={C.fat}
                fillOpacity={opacity}
              />
            </G>
          );
        })}
      </Svg>

      {/* Legend + averages (dimmed when no data) */}
      <View className="flex-row justify-around mt-3">
        {[
          { label: 'Protein', color: C.protein, value: allEmpty ? '–' : `${avgProtein}g` },
          { label: 'Carbs', color: C.carbs, value: allEmpty ? '–' : `${avgCarbs}g` },
          { label: 'Fat', color: C.fat, value: allEmpty ? '–' : `${avgFat}g` },
        ].map(({ label, color, value }) => (
          <View key={label} className="flex-row items-center gap-1.5">
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                backgroundColor: color,
                opacity: allEmpty ? 0.3 : 1,
              }}
            />
            <Text
              className={`text-xs font-sans-medium ${allEmpty ? 'text-text-tertiary' : 'text-text-secondary'}`}
            >
              {label}: {value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Water bar chart ──────────────────────────────────────────────────────────

function WaterBarChart({ points, chartWidth }: { points: ChartPoint[]; chartWidth: number }) {
  const GOAL_ML = 2000;
  const CHART_H = 80;
  const PAD = { top: 8, bottom: 4 };
  const plotH = CHART_H - PAD.top - PAD.bottom;

  const count = points.length;
  const gap = count > 8 ? 3 : 6;
  const barW = Math.max(4, (chartWidth - gap * (count - 1)) / count);

  const allEmpty = points.every((p) => p.waterMl === 0);
  const maxWater = Math.max(...points.map((p) => p.waterMl), GOAL_ML) * 1.1;
  const scale = (v: number) => (v / maxWater) * plotH;
  const goalY = PAD.top + plotH - scale(GOAL_ML);

  return (
    <View>
      <Svg width={chartWidth} height={CHART_H}>
        {points.map((p, i) => {
          const x = i * (barW + gap);
          const rx = barW > 10 ? Math.min(4, barW / 3) : 2;
          let h: number, fill: string, opacity: number;

          if (allEmpty) {
            // Ghost preview bars around the 2L goal line with natural variation
            h = Math.max(3, scale(GOAL_ML * ghostFrac(i)));
            fill = C.water;
            opacity = 0.18;
          } else if (p.waterMl > 0) {
            h = Math.max(3, scale(p.waterMl));
            fill = C.water;
            opacity = p.waterMl >= GOAL_ML ? 1 : 0.75;
          } else {
            h = 5;
            fill = C.waterLight;
            opacity = 0.5;
          }

          const y = PAD.top + plotH - h;
          return (
            <Rect
              key={i}
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={rx}
              fill={fill}
              fillOpacity={opacity}
            />
          );
        })}

        {/* Goal line — always visible so context is clear even before any data */}
        <Line
          x1={0}
          y1={goalY}
          x2={chartWidth}
          y2={goalY}
          stroke={C.water}
          strokeWidth={1}
          strokeDasharray="4,4"
          strokeOpacity={allEmpty ? 0.4 : 0.6}
        />
      </Svg>
    </View>
  );
}

// ─── Nutrition tab ────────────────────────────────────────────────────────────

function NutritionTab({ chartWidth }: { chartWidth: number }) {
  const [period, setPeriod] = useState<HistoryPeriod>(7);
  const { data, isLoading, fetchHistory } = useNutritionHistoryStore();

  useEffect(() => {
    fetchHistory(period);
  }, [period, fetchHistory]);

  const historyData = data[period];
  const points = historyData ? toChartPoints(historyData.history, period) : [];
  const target = historyData?.target ?? null;
  const hasAnyData = points.some((p) => p.hasData);

  const periodLabel = (p: HistoryPeriod) => (p === 7 ? '7D' : p === 30 ? '30D' : '90D');

  if (isLoading && !historyData) {
    return <NutritionSkeleton />;
  }

  return (
    <View>
      {/* Welcome banner — shown only when no data exists for this period */}
      {!hasAnyData && (
        <Animated.View entering={FadeInDown.duration(400)} className="mb-4">
          <LinearGradient
            colors={['#f0f4fb', '#eaf0f8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: 20, borderWidth: 1, borderColor: themeColors.surface.border }}
          >
            <View className="p-4 flex-row items-center gap-3">
              <View
                className="h-11 w-11 rounded-2xl items-center justify-center"
                style={{ backgroundColor: 'rgba(15,23,42,0.07)' }}
              >
                <Ionicons name="nutrition" size={22} color={themeColors.primary['500']} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-sans-bold text-text">Your trends start here</Text>
                <Text className="text-xs text-text-secondary mt-0.5 leading-4">
                  Log your first meal and this chart will come alive with your real data.
                </Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>
      )}

      {/* Period selector */}
      <View className="flex-row rounded-2xl bg-surface-card border border-surface-border p-1 mb-4">
        {HISTORY_PERIODS.map((p) => (
          <Pressable
            key={p}
            onPress={() => setPeriod(p)}
            className={`flex-1 rounded-xl py-2.5 items-center ${period === p ? 'bg-primary-500' : ''}`}
          >
            <Text
              className={`font-sans-semibold text-sm ${
                period === p ? 'text-text-inverse' : 'text-text-secondary'
              }`}
            >
              {periodLabel(p)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Summary cards */}
      <SummaryCards points={points} targetCalories={target?.calories ?? null} period={period} />

      {/* Calorie history */}
      <Animated.View entering={FadeInDown.delay(50).duration(350)} className="mb-4">
        <View className="rounded-2xl bg-surface-card border border-surface-border p-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-sm font-sans-semibold text-text">Calories</Text>
            {target && (
              <View className="flex-row items-center gap-1.5">
                <View style={{ width: 8, height: 2, backgroundColor: C.goal, borderRadius: 1 }} />
                <Text className="text-[10px] text-text-tertiary font-sans-medium">
                  {target.calories.toLocaleString()} goal
                </Text>
              </View>
            )}
          </View>
          <CalorieBarChart
            points={points}
            targetCalories={target?.calories ?? null}
            chartWidth={chartWidth}
          />
        </View>
      </Animated.View>

      {/* Macro breakdown */}
      <Animated.View entering={FadeInDown.delay(100).duration(350)} className="mb-4">
        <View className="rounded-2xl bg-surface-card border border-surface-border p-4">
          <Text className="text-sm font-sans-semibold text-text mb-3">Macros (avg / day)</Text>
          <MacroStackedChart points={points} chartWidth={chartWidth} />
        </View>
      </Animated.View>

      {/* Water intake */}
      <Animated.View entering={FadeInDown.delay(150).duration(350)} className="mb-4">
        <View className="rounded-2xl bg-surface-card border border-surface-border p-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-sm font-sans-semibold text-text">Water</Text>
            <View className="flex-row items-center gap-1.5">
              <View style={{ width: 8, height: 2, backgroundColor: C.water, borderRadius: 1 }} />
              <Text className="text-[10px] text-text-tertiary font-sans-medium">2,000 ml goal</Text>
            </View>
          </View>
          <WaterBarChart points={points} chartWidth={chartWidth} />
        </View>
      </Animated.View>
    </View>
  );
}

function NutritionSkeleton() {
  return (
    <View className="gap-4">
      <SkeletonLoader height={48} borderRadius={16} />
      <View className="flex-row gap-2">
        <SkeletonLoader height={72} borderRadius={16} className="flex-1" />
        <SkeletonLoader height={72} borderRadius={16} className="flex-1" />
        <SkeletonLoader height={72} borderRadius={16} className="flex-1" />
      </View>
      <SkeletonLoader height={200} borderRadius={16} />
      <SkeletonLoader height={160} borderRadius={16} />
      <SkeletonLoader height={120} borderRadius={16} />
    </View>
  );
}

// ─── Weight chart (existing) ───────────────────────────────────────────────────

function WeightChart({
  data,
  viewportWidth,
  trendHint,
}: {
  data: WeightLogEntry[];
  viewportWidth: number;
  trendHint: string;
}) {
  const chartWidth = viewportWidth - 64;
  const height = 160;
  const padding = { top: 20, right: 16, bottom: 30, left: 48 };

  if (data.length < 2) {
    return (
      <View style={{ width: chartWidth, height }} className="items-center justify-center">
        <View className="h-14 w-14 rounded-full bg-surface-secondary items-center justify-center mb-3">
          <Ionicons name="trending-up-outline" size={24} color={themeColors.text.tertiary} />
        </View>
        <Text className="text-sm text-text-secondary font-sans-medium">{trendHint}</Text>
      </View>
    );
  }

  const sorted = [...data].sort(
    (a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime(),
  );
  const weights = sorted.map((d) => d.weightKg);
  const minW = Math.min(...weights) - 0.5;
  const maxW = Math.max(...weights) + 0.5;
  const range = maxW - minW || 1;
  const chartW = chartWidth - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const points = sorted.map((d, i) => {
    const x = padding.left + (i / (sorted.length - 1)) * chartW;
    const y = padding.top + chartH - ((d.weightKg - minW) / range) * chartH;
    return { x, y, weight: d.weightKg };
  });

  let pathD = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const cpx1 = prev.x + (curr.x - prev.x) * 0.4;
    const cpx2 = prev.x + (curr.x - prev.x) * 0.6;
    pathD += ` C ${cpx1} ${prev.y} ${cpx2} ${curr.y} ${curr.x} ${curr.y}`;
  }

  const areaD = `${pathD} L ${points[points.length - 1]!.x} ${height - padding.bottom} L ${points[0]!.x} ${height - padding.bottom} Z`;

  const yLabels = [minW, (minW + maxW) / 2, maxW].map((v) => ({
    value: v.toFixed(1),
    y: padding.top + chartH - ((v - minW) / range) * chartH,
  }));

  return (
    <View>
      <Svg width={chartWidth} height={height}>
        <Defs>
          <SvgGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={themeColors.primary['500']} stopOpacity={0.3} />
            <Stop offset="100%" stopColor={themeColors.primary['500']} stopOpacity={0} />
          </SvgGradient>
          <SvgGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor={themeColors.primary['400']} />
            <Stop offset="100%" stopColor={themeColors.primary['500']} />
          </SvgGradient>
        </Defs>

        {yLabels.map((l) => (
          <Path
            key={l.value}
            d={`M ${padding.left} ${l.y} L ${chartWidth - padding.right} ${l.y}`}
            stroke={themeColors.surface.border}
            strokeWidth={1}
            strokeDasharray="4,4"
          />
        ))}

        <Path d={areaD} fill="url(#chartGradient)" />
        <Path
          d={pathD}
          fill="none"
          stroke="url(#lineGradient)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((p, i) => (
          <Circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={3}
            fill={themeColors.primary['500']}
            stroke={themeColors.surface.tertiary}
            strokeWidth={2}
          />
        ))}
      </Svg>

      {yLabels.map((l) => (
        <Text
          key={l.value}
          className="absolute text-xs text-text-tertiary font-sans-medium"
          style={{ top: l.y - 7, left: 4 }}
        >
          {l.value}
        </Text>
      ))}
    </View>
  );
}

// ─── Body (weight) tab ────────────────────────────────────────────────────────

function BodyTab({ viewportWidth }: { viewportWidth: number }) {
  const { t } = useLocale();
  const navigation = useNavigation();
  const [period, setPeriod] = useState<WeightPeriod>('week');
  const [sheetVisible, setSheetVisible] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [dateInput, setDateInput] = useState(() => new Date().toISOString().split('T')[0]!);
  const [saving, setSaving] = useState(false);

  const { history, trend, isLoading, fetchHistory, fetchTrend, logWeight } = useWeightStore();

  const load = useCallback(() => {
    fetchHistory(PERIOD_DAYS[period]);
    fetchTrend();
  }, [period, fetchHistory, fetchTrend]);

  useEffect(() => {
    load();
  }, [load]);

  const handleLogWeight = async () => {
    const w = parseFloat(weightInput.replace(',', '.'));
    if (isNaN(w) || w < 20 || w > 500) return;
    setSaving(true);
    try {
      await logWeight(w, dateInput);
      setSheetVisible(false);
      setWeightInput('');
      setDateInput(new Date().toISOString().split('T')[0]!);
    } finally {
      setSaving(false);
    }
  };

  const chartData = history.slice(-PERIOD_DAYS[period]);

  if (isLoading && history.length === 0) {
    return <ProgressSkeleton />;
  }

  const currentWeight = trend?.current ?? history[0]?.weightKg ?? null;
  const weeklyDelta = trend?.weeklyDelta;
  const weeklyAvg = trend?.weeklyAverage;

  return (
    <View>
      {/* Current Weight Hero */}
      <Animated.View entering={FadeInDown.duration(400)} className="mb-4">
        <LinearGradient
          colors={[themeColors.surface.border, themeColors.surface.tertiary]}
          className="rounded-3xl border border-surface-border p-5"
        >
          <View className="items-center">
            {currentWeight !== null ? (
              <>
                <Text className="text-sm text-text-secondary font-sans-medium mb-2">
                  {t('progress.currentWeight')}
                </Text>
                <View className="flex-row items-baseline">
                  <Text className="text-5xl font-sans-bold text-text">{currentWeight}</Text>
                  <Text className="text-xl font-sans-medium text-text-secondary ml-1">kg</Text>
                </View>
                <View className="flex-row gap-3 mt-3">
                  {weeklyDelta !== null && weeklyDelta !== undefined && (
                    <View
                      className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
                      style={{
                        backgroundColor:
                          weeklyDelta < 0
                            ? 'rgba(34, 197, 94, 0.15)'
                            : weeklyDelta > 0
                              ? 'rgba(245, 158, 11, 0.15)'
                              : 'rgba(100, 116, 139, 0.15)',
                      }}
                    >
                      <Ionicons
                        name={
                          weeklyDelta < 0
                            ? 'trending-down'
                            : weeklyDelta > 0
                              ? 'trending-up'
                              : 'remove'
                        }
                        size={14}
                        color={
                          weeklyDelta < 0 ? '#1f2028' : weeklyDelta > 0 ? '#8f93a4' : '#9a9caa'
                        }
                      />
                      <Text
                        className="text-sm font-sans-medium"
                        style={{
                          color:
                            weeklyDelta < 0 ? '#1f2028' : weeklyDelta > 0 ? '#8f93a4' : '#9a9caa',
                        }}
                      >
                        {weeklyDelta > 0 ? '+' : ''}
                        {weeklyDelta} kg
                      </Text>
                    </View>
                  )}
                  {weeklyAvg !== null && weeklyAvg !== undefined && (
                    <View className="flex-row items-center gap-1.5 rounded-full bg-surface-secondary px-3 py-1.5">
                      <Text className="text-sm font-sans-medium text-text-secondary">
                        Avg: {weeklyAvg} kg
                      </Text>
                    </View>
                  )}
                </View>
              </>
            ) : (
              <View className="items-center py-4">
                <View className="h-16 w-16 rounded-full bg-surface-secondary items-center justify-center mb-3">
                  <Ionicons name="scale-outline" size={28} color={themeColors.text.tertiary} />
                </View>
                <Text className="text-base font-sans-medium text-text-secondary">
                  {t('progress.noWeightEntries')}
                </Text>
                <Text className="text-sm text-text-tertiary mt-1">
                  {t('progress.startTracking')}
                </Text>
              </View>
            )}
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Period Tabs */}
      <View className="flex-row rounded-2xl bg-surface-card border border-surface-border p-1 mb-4">
        {(['week', 'month', '3months'] as const).map((p) => (
          <Pressable
            key={p}
            onPress={() => setPeriod(p)}
            className={`flex-1 rounded-xl py-2.5 items-center ${
              period === p ? 'bg-primary-500' : ''
            }`}
          >
            <Text
              className={`font-sans-semibold text-sm ${
                period === p ? 'text-text-inverse' : 'text-text-secondary'
              }`}
            >
              {p === 'week'
                ? t('progress.period7Days')
                : p === 'month'
                  ? t('progress.period30Days')
                  : t('progress.period90Days')}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Chart */}
      <Animated.View entering={FadeInDown.delay(100).duration(400)} className="mb-6">
        <View className="rounded-2xl bg-surface-card border border-surface-border p-4">
          <Text className="text-sm font-sans-semibold text-text-secondary mb-3">
            {t('progress.weightTrend')}
          </Text>
          <View className="items-center">
            <WeightChart
              data={chartData}
              viewportWidth={viewportWidth}
              trendHint={t('progress.logMoreWeights')}
            />
          </View>
        </View>
      </Animated.View>

      {/* Stats Row */}
      {history.length > 0 && (
        <Animated.View
          entering={FadeInDown.delay(200).duration(400)}
          className="flex-row gap-3 mb-6"
        >
          <View className="flex-1 rounded-2xl bg-surface-card border border-surface-border p-4 items-center">
            <Ionicons
              name="arrow-down-circle-outline"
              size={22}
              color={themeColors.primary['500']}
            />
            <Text className="text-lg font-sans-bold text-text mt-2">
              {Math.min(...history.map((h) => h.weightKg))}
            </Text>
            <Text className="text-xs text-text-secondary font-sans-medium">
              {t('progress.lowest')}
            </Text>
          </View>
          <View className="flex-1 rounded-2xl bg-surface-card border border-surface-border p-4 items-center">
            <Ionicons name="arrow-up-circle-outline" size={22} color={themeColors.primary['400']} />
            <Text className="text-lg font-sans-bold text-text mt-2">
              {Math.max(...history.map((h) => h.weightKg))}
            </Text>
            <Text className="text-xs text-text-secondary font-sans-medium">
              {t('progress.highest')}
            </Text>
          </View>
          <View className="flex-1 rounded-2xl bg-surface-card border border-surface-border p-4 items-center">
            <Ionicons name="analytics-outline" size={22} color={themeColors.primary['400']} />
            <Text className="text-lg font-sans-bold text-text mt-2">{history.length}</Text>
            <Text className="text-xs text-text-secondary font-sans-medium">
              {t('progress.entries')}
            </Text>
          </View>
        </Animated.View>
      )}

      {/* Weight History List */}
      <View>
        <Text className="text-lg font-sans-semibold text-text mb-3">{t('progress.history')}</Text>

        {history.length > 0 ? (
          <View className="gap-2">
            {[...history]
              .sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime())
              .slice(0, 10)
              .map((entry, idx, arr) => {
                const prev = arr[idx + 1];
                const delta =
                  prev != null ? Number((entry.weightKg - prev.weightKg).toFixed(1)) : null;
                return (
                  <View
                    key={entry.id}
                    className="flex-row items-center justify-between rounded-2xl bg-surface-card border border-surface-border p-4"
                  >
                    <View className="flex-row items-center gap-3">
                      <View className="h-10 w-10 rounded-full bg-surface-secondary items-center justify-center">
                        <Ionicons
                          name="scale-outline"
                          size={18}
                          color={themeColors.text.tertiary}
                        />
                      </View>
                      <Text className="font-sans-medium text-text-secondary">
                        {new Date(entry.loggedAt + 'T12:00:00').toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      {delta !== null && delta !== 0 && (
                        <Badge variant={delta < 0 ? 'success' : 'warning'}>
                          {delta > 0 ? '+' : ''}
                          {delta}
                        </Badge>
                      )}
                      <Text className="font-sans-bold text-text text-base">
                        {entry.weightKg} kg
                      </Text>
                    </View>
                  </View>
                );
              })}
          </View>
        ) : (
          <View className="rounded-2xl bg-surface-card border border-surface-border p-6 items-center">
            <View className="h-14 w-14 rounded-full bg-surface-secondary items-center justify-center mb-3">
              <Ionicons name="heart-outline" size={24} color={themeColors.text.tertiary} />
            </View>
            <Text className="text-base font-sans-medium text-text mb-1">
              {t('progress.noWeightEntries')}
            </Text>
            <Text className="text-sm text-text-secondary text-center mb-4">
              {t('progress.noWeightEntriesDesc')}
            </Text>
          </View>
        )}
      </View>

      {/* Log weight FAB */}
      <View className="items-end mt-6">
        <Pressable
          onPress={() => setSheetVisible(true)}
          className="h-14 w-14 items-center justify-center rounded-full bg-primary-500 shadow-lg shadow-primary-500/40"
          accessibilityRole="button"
          accessibilityLabel={t('progress.logWeight')}
        >
          <Ionicons name="add" size={28} color="white" />
        </Pressable>
      </View>

      <BottomSheet visible={sheetVisible} onClose={() => setSheetVisible(false)}>
        <View className="px-1">
          <Text className="mb-1 text-lg font-sans-bold text-text">{t('progress.logWeight')}</Text>
          <Text className="mb-5 text-sm text-text-secondary">{t('progress.logWeightDesc')}</Text>
          <Input
            label={t('progress.weightKg')}
            placeholder={t('progress.weightPlaceholder')}
            value={weightInput}
            onChangeText={setWeightInput}
            keyboardType="decimal-pad"
            containerClassName="mb-4"
          />
          <View className="mb-6">
            <Text className="mb-1.5 text-sm font-sans-medium text-text-secondary">
              {t('progress.date')}
            </Text>
            <View className="flex-row gap-2 mb-2">
              {[
                { label: 'Today', offset: 0 },
                { label: 'Yesterday', offset: -1 },
              ].map(({ label, offset }) => {
                const d = new Date();
                d.setDate(d.getDate() + offset);
                const key = d.toISOString().split('T')[0] ?? '';
                const isActive = dateInput === key;
                return (
                  <Pressable
                    key={label}
                    onPress={() => setDateInput(key)}
                    className={`rounded-full px-4 py-2 border ${isActive ? 'bg-primary-500 border-primary-500' : 'bg-surface-card border-surface-border'}`}
                  >
                    <Text
                      className={`text-sm font-sans-medium ${isActive ? 'text-white' : 'text-text-secondary'}`}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Input
              placeholder="YYYY-MM-DD"
              value={dateInput}
              onChangeText={setDateInput}
              containerClassName="mb-0"
            />
          </View>
          <Button
            variant="primary"
            onPress={handleLogWeight}
            loading={saving}
            disabled={!weightInput.trim()}
          >
            {t('progress.saveWeight')}
          </Button>
        </View>
      </BottomSheet>
    </View>
  );
}

// ─── Main ProgressScreen ──────────────────────────────────────────────────────

export function ProgressScreen() {
  const { t } = useLocale();
  const { width } = useWindowDimensions();
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<ProgressTab>('nutrition');

  // Chart interior width: screen - 2*px-4 padding - 2*p-4 card padding
  const chartWidth = width - 32 - 32;

  return (
    <View className="flex-1 bg-surface-app">
      <SafeAreaView edges={['top']} className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View className="px-5 pt-2 pb-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-2xl font-sans-bold text-text">{t('progress.title')}</Text>
              <Pressable
                onPress={() =>
                  (
                    navigation.getParent() as { navigate: (s: string) => void } | undefined
                  )?.navigate('WeeklySummary')
                }
                className="flex-row items-center gap-2 rounded-full bg-primary-500/15 px-4 py-2"
              >
                <Ionicons name="calendar-outline" size={16} color={themeColors.primary['500']} />
                <Text className="font-sans-medium text-primary-400 text-sm">
                  {t('progress.weekly')}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Tab selector: Nutrition | Body */}
          <View className="px-4 mb-5">
            <View
              className="flex-row rounded-2xl p-1"
              style={{ backgroundColor: themeColors.surface.secondary }}
            >
              {(['nutrition', 'body'] as const).map((tab) => (
                <Pressable
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  className={`flex-1 rounded-xl py-2.5 items-center flex-row justify-center gap-1.5 ${
                    activeTab === tab ? 'bg-surface-card' : ''
                  }`}
                  style={
                    activeTab === tab
                      ? {
                          shadowColor: '#0b1220',
                          shadowOpacity: 0.08,
                          shadowRadius: 8,
                          shadowOffset: { width: 0, height: 2 },
                          elevation: 3,
                        }
                      : {}
                  }
                >
                  <Ionicons
                    name={tab === 'nutrition' ? 'nutrition-outline' : 'body-outline'}
                    size={15}
                    color={activeTab === tab ? themeColors.text.primary : themeColors.text.tertiary}
                  />
                  <Text
                    className={`font-sans-semibold text-sm ${
                      activeTab === tab ? 'text-text' : 'text-text-tertiary'
                    }`}
                  >
                    {tab === 'nutrition' ? 'Nutrition' : 'Body'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Tab content */}
          <View className="px-4">
            {activeTab === 'nutrition' ? (
              <NutritionTab chartWidth={chartWidth} />
            ) : (
              <BodyTab viewportWidth={width} />
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function ProgressSkeleton() {
  return (
    <View className="gap-4">
      <SkeletonLoader height={180} borderRadius={24} />
      <SkeletonLoader height={48} borderRadius={16} />
      <SkeletonLoader height={220} borderRadius={16} />
      <SkeletonLoader height={120} borderRadius={16} />
    </View>
  );
}
