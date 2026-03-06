import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop, Circle } from 'react-native-svg';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  Button,
  BottomSheet,
  Input,
  Badge,
  LoadingScreen,
} from '../components/ui';
import { useWeightStore, type WeightLogEntry } from '../stores/weight.store';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Period = 'week' | 'month' | '3months';

const PERIOD_DAYS: Record<Period, number> = {
  week: 7,
  month: 30,
  '3months': 90,
};

function WeightChart({ data }: { data: WeightLogEntry[] }) {
  const chartWidth = SCREEN_WIDTH - 64;
  const height = 160;
  const padding = { top: 20, right: 16, bottom: 30, left: 48 };

  if (data.length < 2) {
    return (
      <View style={{ width: chartWidth, height }} className="items-center justify-center">
        <View className="h-14 w-14 rounded-full bg-surface-secondary items-center justify-center mb-3">
          <Ionicons name="trending-up-outline" size={24} color="#777985" />
        </View>
        <Text className="text-sm text-text-secondary font-sans-medium">
          Log more weights to see your trend
        </Text>
      </View>
    );
  }

  const sorted = [...data].sort(
    (a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime()
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

  // Smooth curve using cubic bezier
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx1 = prev.x + (curr.x - prev.x) * 0.4;
    const cpx2 = prev.x + (curr.x - prev.x) * 0.6;
    pathD += ` C ${cpx1} ${prev.y} ${cpx2} ${curr.y} ${curr.x} ${curr.y}`;
  }

  // Area fill path
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding.bottom} L ${points[0].x} ${height - padding.bottom} Z`;

  // Y-axis labels
  const yLabels = [minW, (minW + maxW) / 2, maxW].map((v) => ({
    value: v.toFixed(1),
    y: padding.top + chartH - ((v - minW) / range) * chartH,
  }));

  return (
    <View>
      <Svg width={chartWidth} height={height}>
        <Defs>
          <SvgGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#1f2028" stopOpacity={0.3} />
            <Stop offset="100%" stopColor="#1f2028" stopOpacity={0} />
          </SvgGradient>
          <SvgGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor="#2a2b35" />
            <Stop offset="100%" stopColor="#1f2028" />
          </SvgGradient>
        </Defs>

        {/* Grid lines */}
        {yLabels.map((l) => (
          <Path
            key={l.value}
            d={`M ${padding.left} ${l.y} L ${chartWidth - padding.right} ${l.y}`}
            stroke="#dedee6"
            strokeWidth={1}
            strokeDasharray="4,4"
          />
        ))}

        {/* Area fill */}
        <Path d={areaD} fill="url(#chartGradient)" />

        {/* Line */}
        <Path
          d={pathD}
          fill="none"
          stroke="url(#lineGradient)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {points.map((p, i) => (
          <Circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={3}
            fill="#1f2028"
            stroke="#ececf2"
            strokeWidth={2}
          />
        ))}
      </Svg>

      {/* Y-axis labels */}
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

export function ProgressScreen() {
  const navigation = useNavigation();
  const [period, setPeriod] = useState<Period>('week');
  const [sheetVisible, setSheetVisible] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [dateInput, setDateInput] = useState(() =>
    new Date().toISOString().split('T')[0]
  );
  const [saving, setSaving] = useState(false);

  const { history, trend, isLoading, fetchHistory, fetchTrend, logWeight } =
    useWeightStore();

  const load = useCallback(() => {
    const days = PERIOD_DAYS[period];
    fetchHistory(days);
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
      setDateInput(new Date().toISOString().split('T')[0]);
    } finally {
      setSaving(false);
    }
  };

  const chartData = history.slice(-PERIOD_DAYS[period]);

  if (isLoading && history.length === 0) {
    return <LoadingScreen />;
  }

  const currentWeight = trend?.current ?? history[0]?.weightKg ?? null;
  const weeklyDelta = trend?.weeklyDelta;
  const weeklyAvg = trend?.weeklyAverage;

  return (
    <View className="flex-1 bg-surface-app">
      <SafeAreaView edges={['top']} className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View className="px-5 pt-2 pb-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-2xl font-sans-bold text-text">
                Progress
              </Text>
              <Pressable
                onPress={() =>
                  (navigation.getParent() as { navigate: (s: string) => void } | undefined)
                    ?.navigate('WeeklySummary')
                }
                className="flex-row items-center gap-2 rounded-full bg-primary-500/15 px-4 py-2"
              >
                <Ionicons name="calendar-outline" size={16} color="#1f2028" />
                <Text className="font-sans-medium text-primary-400 text-sm">
                  Weekly
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Current Weight Hero */}
          <Animated.View entering={FadeInDown.duration(400)} className="px-4 mb-4">
            <LinearGradient
              colors={['#dedee6', '#ececf2']}
              className="rounded-3xl border border-surface-border p-5"
            >
              <View className="items-center">
                {currentWeight !== null ? (
                  <>
                    <Text className="text-sm text-text-secondary font-sans-medium mb-2">
                      Current Weight
                    </Text>
                    <View className="flex-row items-baseline">
                      <Text className="text-5xl font-sans-bold text-text">
                        {currentWeight}
                      </Text>
                      <Text className="text-xl font-sans-medium text-text-secondary ml-1">
                        kg
                      </Text>
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
                              weeklyDelta < 0
                                ? '#1f2028'
                                : weeklyDelta > 0
                                  ? '#8f93a4'
                                  : '#9a9caa'
                            }
                          />
                          <Text
                            className="text-sm font-sans-medium"
                            style={{
                              color:
                                weeklyDelta < 0
                                  ? '#1f2028'
                                  : weeklyDelta > 0
                                    ? '#8f93a4'
                                    : '#9a9caa',
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
                      <Ionicons name="scale-outline" size={28} color="#777985" />
                    </View>
                    <Text className="text-base font-sans-medium text-text-secondary">
                      No weight logged yet
                    </Text>
                    <Text className="text-sm text-text-tertiary mt-1">
                      Start tracking your weight journey
                    </Text>
                  </View>
                )}
              </View>
            </LinearGradient>
          </Animated.View>

          {/* Period Tabs */}
          <View className="px-4 mb-4">
            <View className="flex-row rounded-2xl bg-surface-card border border-surface-border p-1">
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
                    {p === 'week' ? '7 Days' : p === 'month' ? '30 Days' : '90 Days'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Chart */}
          <Animated.View
            entering={FadeInDown.delay(100).duration(400)}
            className="px-4 mb-6"
          >
            <View className="rounded-2xl bg-surface-card border border-surface-border p-4">
              <Text className="text-sm font-sans-semibold text-text-secondary mb-3">
                Weight Trend
              </Text>
              <View className="items-center">
                <WeightChart data={chartData} />
              </View>
            </View>
          </Animated.View>

          {/* Stats Row */}
          {history.length > 0 && (
            <Animated.View
              entering={FadeInDown.delay(200).duration(400)}
              className="flex-row gap-3 px-4 mb-6"
            >
              <View className="flex-1 rounded-2xl bg-surface-card border border-surface-border p-4 items-center">
                <Ionicons name="arrow-down-circle-outline" size={22} color="#1f2028" />
                <Text className="text-lg font-sans-bold text-text mt-2">
                  {Math.min(...history.map((h) => h.weightKg))}
                </Text>
                <Text className="text-xs text-text-secondary font-sans-medium">
                  Lowest
                </Text>
              </View>
              <View className="flex-1 rounded-2xl bg-surface-card border border-surface-border p-4 items-center">
                <Ionicons name="arrow-up-circle-outline" size={22} color="#8f93a4" />
                <Text className="text-lg font-sans-bold text-text mt-2">
                  {Math.max(...history.map((h) => h.weightKg))}
                </Text>
                <Text className="text-xs text-text-secondary font-sans-medium">
                  Highest
                </Text>
              </View>
              <View className="flex-1 rounded-2xl bg-surface-card border border-surface-border p-4 items-center">
                <Ionicons name="analytics-outline" size={22} color="#8b8fa0" />
                <Text className="text-lg font-sans-bold text-text mt-2">
                  {history.length}
                </Text>
                <Text className="text-xs text-text-secondary font-sans-medium">
                  Entries
                </Text>
              </View>
            </Animated.View>
          )}

          {/* Weight History */}
          <View className="px-4">
            <Text className="text-lg font-sans-semibold text-text mb-3">
              History
            </Text>

            {history.length > 0 ? (
              <View className="gap-2">
                {[...history]
                  .sort(
                    (a, b) =>
                      new Date(b.loggedAt).getTime() -
                      new Date(a.loggedAt).getTime()
                  )
                  .slice(0, 10)
                  .map((entry, idx, arr) => {
                    const prev = arr[idx + 1];
                    const delta =
                      prev != null
                        ? Number((entry.weightKg - prev.weightKg).toFixed(1))
                        : null;
                    return (
                      <View
                        key={entry.id}
                        className="flex-row items-center justify-between rounded-2xl bg-surface-card border border-surface-border p-4"
                      >
                        <View className="flex-row items-center gap-3">
                          <View className="h-10 w-10 rounded-full bg-surface-secondary items-center justify-center">
                            <Ionicons name="scale-outline" size={18} color="#9a9caa" />
                          </View>
                          <Text className="font-sans-medium text-text-secondary">
                            {new Date(entry.loggedAt + 'T12:00:00').toLocaleDateString(
                              undefined,
                              { weekday: 'short', month: 'short', day: 'numeric' }
                            )}
                          </Text>
                        </View>
                        <View className="flex-row items-center gap-2">
                          {delta !== null && delta !== 0 && (
                            <Badge
                              variant={delta < 0 ? 'success' : 'warning'}
                            >
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
                  <Ionicons name="heart-outline" size={24} color="#777985" />
                </View>
                <Text className="text-base font-sans-medium text-text mb-1">
                  No weight logs yet
                </Text>
                <Text className="text-sm text-text-secondary text-center mb-4">
                  Tap the button below to log your first weight
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* FAB */}
        <View className="absolute bottom-6 right-5">
          <Pressable
            onPress={() => setSheetVisible(true)}
            className="h-14 w-14 items-center justify-center rounded-full bg-primary-500 shadow-lg shadow-primary-500/40"
          >
            <Ionicons name="add" size={28} color="white" />
          </Pressable>
        </View>

        <BottomSheet
          visible={sheetVisible}
          onClose={() => setSheetVisible(false)}
        >
          <View className="px-1">
            <Text className="mb-1 text-lg font-sans-bold text-text">
              Log Weight
            </Text>
            <Text className="mb-5 text-sm text-text-secondary">
              Track your daily weight measurement
            </Text>
            <Input
              label="Weight (kg)"
              placeholder="e.g. 72.5"
              value={weightInput}
              onChangeText={setWeightInput}
              keyboardType="decimal-pad"
              containerClassName="mb-4"
            />
            <Input
              label="Date"
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
              Save Weight
            </Button>
          </View>
        </BottomSheet>
      </SafeAreaView>
    </View>
  );
}
