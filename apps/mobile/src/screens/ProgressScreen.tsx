import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Button, BottomSheet, Input, SkeletonLoader } from '../components/ui';
import { useWeightStore, type WeightLogEntry } from '../stores/weight.store';
import { useNutritionHistoryStore, type HistoryPeriod } from '../stores/nutrition-history.store';
import { useLocale } from '../i18n';
import { useColors } from '../theme';
import type { DayHistory } from '../api/dashboard';
import { displayWeight, inputToKg, weightRange } from '../utils/units';

type WeightPeriod = 'week' | 'month' | '3months';
type ProgressTab = 'nutrition' | 'weight';

const PERIOD_DAYS: Record<WeightPeriod, number> = {
  week: 7,
  month: 30,
  '3months': 90,
};

const HISTORY_PERIODS: HistoryPeriod[] = [7, 30, 90];

function avgCalories(history: DayHistory[]): number {
  const logged = history.filter((day) => day.calories > 0);
  if (logged.length === 0) return 0;
  return Math.round(logged.reduce((sum, day) => sum + day.calories, 0) / logged.length);
}

function NutritionTab() {
  const c = useColors();
  const { t } = useLocale();
  const [period, setPeriod] = useState<HistoryPeriod>(7);
  const { data, isLoading, fetchHistory } = useNutritionHistoryStore();

  useEffect(() => {
    fetchHistory(period);
  }, [period, fetchHistory]);

  const historyData = data[period];
  const history = historyData?.history ?? [];
  const target = historyData?.target?.calories ?? null;
  const loggedDays = history.filter((day) => day.calories > 0).length;
  const average = avgCalories(history);

  if (isLoading && !historyData) return <ProgressSkeleton />;

  return (
    <View>
      <View className="flex-row rounded-2xl bg-surface-card border border-surface-border p-1 mb-4">
        {HISTORY_PERIODS.map((days) => (
          <Pressable
            key={days}
            onPress={() => setPeriod(days)}
            className={`flex-1 rounded-xl py-2.5 items-center ${period === days ? 'bg-primary-500' : ''}`}
          >
            <Text
              className={`font-sans-semibold text-sm ${
                period === days ? 'text-text-inverse' : 'text-text-secondary'
              }`}
            >
              {days === 7 ? '7D' : days === 30 ? '30D' : '90D'}
            </Text>
          </Pressable>
        ))}
      </View>

      <Animated.View entering={FadeInDown.duration(300)} className="mb-4">
        <View className="rounded-2xl bg-surface-card border border-surface-border p-4">
          <Text className="text-sm font-sans-semibold text-text mb-3">
            {t('progressTab.calories')}
          </Text>
          <View className="flex-row gap-3">
            <Metric label={t('progressTab.avgPerDay')} value={average || '-'} sub="kcal" />
            <Metric
              label={t('progressTab.logged')}
              value={loggedDays}
              sub={`${t('progressTab.of')} ${history.length}`}
            />
            <Metric label={t('progressTab.goal')} value={target ?? '-'} sub="kcal" />
          </View>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(60).duration(300)} className="mb-4">
        <View className="rounded-2xl bg-surface-card border border-surface-border p-4">
          <Text className="text-sm font-sans-semibold text-text mb-3">
            {t('progressTab.thisWeek')}
          </Text>
          <View className="gap-2">
            {history.slice(-7).map((day) => {
              const pct = target ? Math.min(day.calories / target, 1) : 0;
              return (
                <View key={day.date}>
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-xs text-text-tertiary font-sans-medium">{day.date}</Text>
                    <Text className="text-xs text-text-secondary font-sans-semibold">
                      {day.calories} kcal
                    </Text>
                  </View>
                  <View className="h-2 rounded-full bg-surface-secondary overflow-hidden">
                    <View
                      className="h-full rounded-full"
                      style={{ width: `${pct * 100}%`, backgroundColor: c.primary }}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

function Metric({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <View className="flex-1 rounded-xl bg-surface-secondary p-3 items-center">
      <Text className="text-lg font-sans-bold text-text">{value}</Text>
      <Text className="text-[10px] text-text-tertiary font-sans-medium mt-0.5" numberOfLines={1}>
        {label}
      </Text>
      <Text className="text-[10px] text-text-tertiary font-sans-medium">{sub}</Text>
    </View>
  );
}

function WeightChart({ data, viewportWidth }: { data: WeightLogEntry[]; viewportWidth: number }) {
  const c = useColors();
  const { t } = useLocale();
  const chartWidth = viewportWidth - 64;
  const height = 160;
  const padding = { top: 20, right: 16, bottom: 30, left: 48 };

  if (data.length < 2) {
    return (
      <View style={{ width: chartWidth, height }} className="items-center justify-center">
        <Ionicons name="trending-up-outline" size={24} color={c.textTertiary} />
        <Text className="text-sm text-text-secondary font-sans-medium mt-2">
          {t('progress.logMoreWeights')}
        </Text>
      </View>
    );
  }

  const sorted = [...data].sort(
    (a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime(),
  );
  const weights = sorted.map((entry) => displayWeight(entry.weightKg));
  const minW = Math.min(...weights) - 0.5;
  const maxW = Math.max(...weights) + 0.5;
  const range = maxW - minW || 1;
  const chartW = chartWidth - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const points = sorted.map((entry, index) => {
    const weight = displayWeight(entry.weightKg);
    return {
      x: padding.left + (index / (sorted.length - 1)) * chartW,
      y: padding.top + chartH - ((weight - minW) / range) * chartH,
      weight,
    };
  });

  const pathD = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
  const areaD = `${pathD} L ${points[points.length - 1]!.x} ${height - padding.bottom} L ${points[0]!.x} ${height - padding.bottom} Z`;

  return (
    <Svg width={chartWidth} height={height}>
      <Defs>
        <SvgGradient id="weightArea" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={c.primary} stopOpacity={0.25} />
          <Stop offset="100%" stopColor={c.primary} stopOpacity={0} />
        </SvgGradient>
      </Defs>
      <Path d={areaD} fill="url(#weightArea)" />
      <Path d={pathD} fill="none" stroke={c.primary} strokeWidth={2.5} />
      {points.map((point, index) => (
        <Circle key={index} cx={point.x} cy={point.y} r={3} fill={c.primary} />
      ))}
    </Svg>
  );
}

function WeightTab({ viewportWidth }: { viewportWidth: number }) {
  const c = useColors();
  const { t } = useLocale();
  const wRange = weightRange();
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
    const parsed = parseFloat(weightInput.replace(',', '.'));
    if (Number.isNaN(parsed) || parsed < wRange.min || parsed > wRange.max) return;
    setSaving(true);
    try {
      await logWeight(inputToKg(parsed), dateInput);
      setSheetVisible(false);
      setWeightInput('');
      setDateInput(new Date().toISOString().split('T')[0]!);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading && history.length === 0) return <ProgressSkeleton />;

  const currentWeight = trend?.current ?? history[0]?.weightKg ?? null;
  const chartData = history.slice(-PERIOD_DAYS[period]);

  return (
    <View>
      <Animated.View entering={FadeInDown.duration(300)} className="mb-4">
        <LinearGradient
          colors={[c.border, c.cardAlt]}
          className="rounded-3xl border border-surface-border p-5"
        >
          <View className="items-center">
            <Text className="text-sm text-text-secondary font-sans-medium mb-2">
              {t('progress.currentWeight')}
            </Text>
            <View className="flex-row items-baseline">
              <Text className="text-5xl font-sans-bold text-text">
                {currentWeight !== null ? displayWeight(currentWeight) : '-'}
              </Text>
              <Text className="text-xl font-sans-medium text-text-secondary ml-1">kg</Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      <View className="flex-row rounded-2xl bg-surface-card border border-surface-border p-1 mb-4">
        {(['week', 'month', '3months'] as const).map((item) => (
          <Pressable
            key={item}
            onPress={() => setPeriod(item)}
            className={`flex-1 rounded-xl py-2.5 items-center ${period === item ? 'bg-primary-500' : ''}`}
          >
            <Text
              className={`font-sans-semibold text-sm ${
                period === item ? 'text-text-inverse' : 'text-text-secondary'
              }`}
            >
              {item === 'week'
                ? t('progress.period7Days')
                : item === 'month'
                  ? t('progress.period30Days')
                  : t('progress.period90Days')}
            </Text>
          </Pressable>
        ))}
      </View>

      <View className="rounded-2xl bg-surface-card border border-surface-border p-4 mb-4">
        <Text className="text-sm font-sans-semibold text-text-secondary mb-3">
          {t('progress.weightTrend')}
        </Text>
        <WeightChart data={chartData} viewportWidth={viewportWidth} />
      </View>

      <Pressable
        onPress={() => setSheetVisible(true)}
        className="flex-row items-center justify-center gap-2 rounded-2xl bg-primary-500 py-3.5"
      >
        <Ionicons name="scale-outline" size={18} color="white" />
        <Text className="font-sans-semibold text-on-primary text-sm">
          {t('progress.logWeight')}
        </Text>
      </Pressable>

      <BottomSheet visible={sheetVisible} onClose={() => setSheetVisible(false)}>
        <View className="px-1">
          <Text className="mb-1 text-lg font-sans-bold text-text">{t('progress.logWeight')}</Text>
          <Text className="mb-5 text-sm text-text-secondary">{t('progress.logWeightDesc')}</Text>
          <Input
            label={`${t('progress.currentWeight')} (kg)`}
            placeholder={wRange.placeholder}
            value={weightInput}
            onChangeText={setWeightInput}
            keyboardType="decimal-pad"
            containerClassName="mb-4"
          />
          <Input
            label={t('progress.date')}
            placeholder="YYYY-MM-DD"
            value={dateInput}
            onChangeText={setDateInput}
            containerClassName="mb-6"
          />
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

export function ProgressScreen() {
  const c = useColors();
  const { t } = useLocale();
  const { width } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<ProgressTab>('nutrition');

  return (
    <View className="flex-1 bg-surface-app">
      <SafeAreaView edges={['top']} className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="px-5 pt-2 pb-4">
            <Text className="text-2xl font-sans-bold text-text">{t('progress.title')}</Text>
          </View>

          <View className="px-4 mb-5">
            <View className="flex-row rounded-2xl p-1" style={{ backgroundColor: c.cardAlt }}>
              {(['nutrition', 'weight'] as const).map((tab) => (
                <Pressable
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  className={`flex-1 rounded-xl py-2.5 items-center flex-row justify-center gap-1.5 ${
                    activeTab === tab ? 'bg-surface-card' : ''
                  }`}
                >
                  <Ionicons
                    name={tab === 'nutrition' ? 'nutrition-outline' : 'scale-outline'}
                    size={15}
                    color={activeTab === tab ? c.text : c.textTertiary}
                  />
                  <Text
                    className={`font-sans-semibold text-sm ${
                      activeTab === tab ? 'text-text' : 'text-text-tertiary'
                    }`}
                  >
                    {tab === 'nutrition' ? t('progressTab.nutrition') : t('progress.weight')}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="px-4">
            {activeTab === 'nutrition' ? <NutritionTab /> : <WeightTab viewportWidth={width} />}
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
    </View>
  );
}
