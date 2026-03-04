import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import {
  Card,
  Button,
  BottomSheet,
  Input,
  Badge,
  EmptyState,
  LoadingScreen,
} from '../components/ui';
import { useWeightStore, type WeightLogEntry } from '../stores/weight.store';

type Period = 'week' | 'month' | '3months';

const PERIOD_DAYS: Record<Period, number> = {
  week: 7,
  month: 30,
  '3months': 90,
};

function WeightChart({ data }: { data: WeightLogEntry[] }) {
  const width = 280;
  const height = 120;
  const padding = { top: 10, right: 10, bottom: 20, left: 40 };

  if (data.length < 2) {
    return (
      <View style={{ width, height }} className="items-center justify-center">
        <Text className="text-sm text-text-secondary dark:text-slate-400">
          Log more weights to see trend
        </Text>
      </View>
    );
  }

  const sorted = [...data].sort(
    (a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime()
  );
  const weights = sorted.map((d) => d.weightKg);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const range = maxW - minW || 1;
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const points = sorted.map((d, i) => {
    const x = padding.left + (i / (sorted.length - 1)) * chartW;
    const y = padding.top + chartH - ((d.weightKg - minW) / range) * chartH;
    return { x, y };
  });

  const pathD = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(' ');

  return (
    <View>
      <Svg width={width} height={height}>
        <Path
          d={pathD}
          fill="none"
          stroke="#22c55e"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
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
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <View className="px-4 pt-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-2xl font-sans-bold text-text dark:text-slate-100">
              Progress
            </Text>
            <Pressable
              onPress={() =>
                (navigation.getParent() as { navigate: (s: string) => void } | undefined)
                  ?.navigate('WeeklySummary')
              }
              className="rounded-full bg-primary-100 px-4 py-2 dark:bg-primary-900/40"
            >
              <Text className="font-sans-medium text-primary-700 dark:text-primary-300">
                Weekly Summary
              </Text>
            </Pressable>
          </View>

          <View className="mt-4 flex-row gap-2">
            {(['week', 'month', '3months'] as const).map((p) => (
              <Pressable
                key={p}
                onPress={() => setPeriod(p)}
                className={`rounded-full px-4 py-2 ${
                  period === p
                    ? 'bg-primary-500'
                    : 'bg-slate-100 dark:bg-slate-700'
                }`}
              >
                <Text
                  className={`font-sans-medium ${
                    period === p
                      ? 'text-white'
                      : 'text-text dark:text-slate-300'
                  }`}
                >
                  {p === 'week' ? 'Week' : p === 'month' ? 'Month' : '3 Months'}
                </Text>
              </Pressable>
            ))}
          </View>

          <Card className="mt-4">
            <View className="items-center">
              {currentWeight !== null ? (
                <>
                  <Text className="text-4xl font-sans-bold text-text dark:text-slate-100">
                    {currentWeight}
                    <Text className="text-2xl font-sans-medium text-text-secondary dark:text-slate-400">
                      {' '}
                      kg
                    </Text>
                  </Text>
                  <View className="mt-2 flex-row gap-2">
                    {weeklyDelta !== null && weeklyDelta !== undefined && (
                      <Badge
                        variant={weeklyDelta < 0 ? 'success' : weeklyDelta > 0 ? 'warning' : 'neutral'}
                      >
                        {weeklyDelta > 0 ? '+' : ''}
                        {weeklyDelta} kg this week
                      </Badge>
                    )}
                    {weeklyAvg !== null && weeklyAvg !== undefined && (
                      <Badge variant="neutral">Avg: {weeklyAvg} kg</Badge>
                    )}
                  </View>
                </>
              ) : (
                <Text className="text-lg text-text-secondary dark:text-slate-400">
                  No weight logged yet
                </Text>
              )}
            </View>
            <View className="mt-4 items-center">
              <WeightChart data={chartData} />
            </View>
          </Card>

          <Text className="mt-4 text-lg font-sans-semibold text-text dark:text-slate-100">
            Weight History
          </Text>

          {history.length > 0 ? (
            <View className="mt-2 gap-2">
              {[...history]
                .sort(
                  (a, b) =>
                    new Date(b.loggedAt).getTime() -
                    new Date(a.loggedAt).getTime()
                )
                .map((entry, idx, arr) => {
                  const prev = arr[idx + 1];
                  const delta =
                    prev != null
                      ? Number((entry.weightKg - prev.weightKg).toFixed(1))
                      : null;
                  return (
                    <Card key={entry.id}>
                      <View className="flex-row items-center justify-between">
                        <Text className="font-sans-medium text-text dark:text-slate-100">
                          {new Date(entry.loggedAt + 'T12:00:00').toLocaleDateString()}
                        </Text>
                        <View className="flex-row items-center gap-2">
                          <Text className="font-sans-semibold text-text dark:text-slate-100">
                            {entry.weightKg} kg
                          </Text>
                          {delta !== null && delta !== 0 && (
                            <Badge
                              variant={
                                delta < 0 ? 'success' : 'warning'
                              }
                            >
                              {delta > 0 ? '+' : ''}
                              {delta}
                            </Badge>
                          )}
                        </View>
                      </View>
                    </Card>
                  );
                })}
            </View>
          ) : (
            <EmptyState
              icon="heart"
              title="No weight logs yet"
              subtitle="Tap the button below to log your first weight"
              actionLabel="Log Weight"
              onAction={() => setSheetVisible(true)}
            />
          )}
        </View>
      </ScrollView>

      <View className="absolute bottom-6 right-4">
        <Pressable
          onPress={() => setSheetVisible(true)}
          className="h-14 w-14 items-center justify-center rounded-full bg-primary-500 shadow-lg"
        >
          <Ionicons name="add" size={28} color="white" />
        </Pressable>
      </View>

      <BottomSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
      >
        <Text className="mb-4 text-lg font-sans-semibold text-text dark:text-slate-100">
          Log Weight
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
          Save
        </Button>
      </BottomSheet>
    </SafeAreaView>
  );
}
