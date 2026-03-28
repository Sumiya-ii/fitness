import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  useWindowDimensions,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withSpring,
  FadeInDown,
} from 'react-native-reanimated';
import { SkeletonLoader } from '../components/ui';
import { useDashboardStore, type DashboardMeal } from '../stores/dashboard.store';
import { useWaterStore } from '../stores/water.store';
import { useStepsStore, STEPS_GOAL, KCAL_PER_STEP } from '../stores/steps.store';
import { useStreakStore } from '../stores/streak.store';
import { useNutritionHistoryStore } from '../stores/nutrition-history.store';
import { useWorkoutStore } from '../stores/workout.store';
import { type DayHistory } from '../api/dashboard';
import { api } from '../api';
import { useLocale } from '../i18n';
import { useColors, type ColorPalette } from '../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// 1 cup ≈ 237 ml (rounded from 236.588)
const CUP_ML = 237;

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: 'dashboard.breakfast',
  lunch: 'dashboard.lunch',
  dinner: 'dashboard.dinner',
  snack: 'dashboard.snack',
};

const MEAL_TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  breakfast: 'sunny-outline',
  lunch: 'restaurant-outline',
  dinner: 'moon-outline',
  snack: 'cafe-outline',
};

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

// Animated progress arc
function ProgressArc({
  progress,
  size,
  strokeWidth,
  color,
  trackColor,
  children,
}: {
  progress: number;
  size: number;
  strokeWidth: number;
  color: string;
  trackColor?: string;
  children?: React.ReactNode;
}) {
  const c = useColors();
  const resolvedTrack = trackColor ?? c.trackBg;
  const anim = useSharedValue(0);
  const radius = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * radius;

  useEffect(() => {
    anim.value = withSpring(Math.min(Math.max(progress, 0), 1), {
      damping: 15,
      stiffness: 100,
    });
  }, [progress, anim]);

  const animProps = useAnimatedProps(() => ({
    strokeDashoffset: circ * (1 - anim.value),
  }));

  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Svg
        width={size}
        height={size}
        style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}
      >
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={resolvedTrack}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circ}
          strokeLinecap="round"
          animatedProps={animProps}
        />
      </Svg>
      {children}
    </View>
  );
}

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const BAR_MAX_H = 96;

function HistoryBarChart({
  history,
  targetCalories,
  onDayPress,
  selectedDateKey,
}: {
  history: DayHistory[];
  targetCalories: number | null;
  onDayPress: (dateKey: string) => void;
  selectedDateKey: string;
}) {
  const c = useColors();
  const maxCal = Math.max(...history.map((d) => d.calories), targetCalories ?? 0, 1);
  const targetLineBottom = targetCalories != null ? (targetCalories / maxCal) * BAR_MAX_H : null;

  return (
    <View style={{ position: 'relative' }}>
      {targetLineBottom != null && (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 20 + targetLineBottom,
            height: 1,
            borderTopWidth: 1,
            borderStyle: 'dashed',
            borderColor: c.border,
          }}
        />
      )}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: BAR_MAX_H + 20 }}>
        {history.map((day) => {
          const hasData = day.calories > 0;
          const barH = hasData ? Math.max((day.calories / maxCal) * BAR_MAX_H, 6) : 6;
          const pcal = day.protein * 4;
          const ccal = day.carbs * 4;
          const fcal = day.fat * 9;
          const isSelected = day.date === selectedDateKey;
          const dayLabel = DAY_LABELS[new Date(day.date + 'T12:00:00').getDay()];

          return (
            <Pressable
              key={day.date}
              onPress={() => onDayPress(day.date)}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'flex-end',
                height: BAR_MAX_H + 20,
              }}
            >
              <View
                style={{
                  width: '55%',
                  height: barH,
                  borderRadius: 4,
                  overflow: 'hidden',
                  opacity: isSelected ? 1 : 0.7,
                }}
              >
                {hasData ? (
                  <>
                    <View style={{ flex: pcal || 0.001, backgroundColor: '#f97316' }} />
                    <View style={{ flex: ccal || 0.001, backgroundColor: '#f59e0b' }} />
                    <View style={{ flex: fcal || 0.001, backgroundColor: '#3b82f6' }} />
                  </>
                ) : (
                  <View style={{ flex: 1, backgroundColor: c.cardAlt }} />
                )}
              </View>
              <Text
                style={{
                  fontSize: 10,
                  fontFamily: isSelected ? 'Inter-Bold' : 'Inter-Medium',
                  color: isSelected ? '#ffffff' : '#71717a',
                  marginTop: 5,
                  height: 14,
                }}
              >
                {dayLabel}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

interface MacroCardProps {
  label: string;
  leftAmount: number;
  eatenAmount: number;
  targetAmount: number;
  unit: string;
  progress: number;
  color: string;
  icon: string;
  showEaten: boolean;
  onToggle: () => void;
}

function MacroCard({
  label,
  leftAmount,
  eatenAmount,
  targetAmount,
  unit,
  progress,
  color,
  icon,
  showEaten,
  onToggle,
}: MacroCardProps) {
  const c = useColors();
  const { t } = useLocale();
  return (
    <Pressable
      className="flex-1 rounded-3xl p-4"
      style={{ backgroundColor: c.card }}
      onPress={onToggle}
    >
      {showEaten ? (
        <Text className="text-xl font-sans-bold text-text leading-tight">
          {eatenAmount}
          <Text className="text-sm font-sans-medium text-text-tertiary">
            {' '}
            /{targetAmount}
            {unit}
          </Text>
        </Text>
      ) : (
        <Text className="text-xl font-sans-bold text-text leading-tight">
          {leftAmount}
          {unit}
        </Text>
      )}
      <Text className="text-xs text-text-tertiary font-sans-medium mb-3" numberOfLines={1}>
        {label} {showEaten ? t('dashboard.eaten') : 'left'}
      </Text>
      <ProgressArc progress={progress} size={52} strokeWidth={5} color={color}>
        <Text style={{ fontSize: 18 }}>{icon}</Text>
      </ProgressArc>
    </Pressable>
  );
}

interface NutrientMiniCardProps {
  label: string;
  value: string;
  unit: string;
  color: string;
  icon: string;
  sublabel?: string;
}

function NutrientMiniCard({ label, value, unit, color, icon, sublabel }: NutrientMiniCardProps) {
  const c = useColors();
  return (
    <View className="flex-1 rounded-3xl p-4" style={{ backgroundColor: c.card }}>
      <Text style={{ fontSize: 20, fontFamily: 'Inter-Bold', color: c.text, lineHeight: 24 }}>
        {value}
      </Text>
      <Text style={{ fontSize: 11, fontFamily: 'Inter-Medium', color: c.textTertiary }}>
        {unit}
      </Text>
      <View className="flex-row items-center gap-1.5 mt-3">
        <Text style={{ fontSize: 16 }}>{icon}</Text>
        <View>
          <Text style={{ fontSize: 11, fontFamily: 'Inter-SemiBold', color }} numberOfLines={1}>
            {label}
          </Text>
          {sublabel ? (
            <Text style={{ fontSize: 9, fontFamily: 'Inter-Medium', color: c.textTertiary }}>
              {sublabel}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

interface MealSectionProps {
  type: string;
  meals: DashboardMeal[];
  typeLabel: string;
}

function MealSection({ type, meals, typeLabel }: MealSectionProps) {
  const c = useColors();
  const navigation = useNavigation();
  const totalCal = meals.reduce((s, m) => s + m.totalCalories, 0);
  const items = meals.flatMap((m) => m.items);

  const handleSaveAsTemplate = () => {
    // Use the first meal in this group as the source
    const meal = meals[0];
    if (!meal) return;
    const itemNames = meal.items.map((i) => i.snapshotFoodName);
    // Navigate to Log tab → SaveTemplate screen
    (navigation as any).navigate('Log', {
      // eslint-disable-line @typescript-eslint/no-explicit-any
      screen: 'SaveTemplate',
      params: { mealLogId: meal.id, mealType: meal.mealType, itemNames },
    });
  };

  return (
    <View className="rounded-3xl p-4 mb-3" style={{ backgroundColor: c.card }}>
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center">
          <Ionicons
            name={MEAL_TYPE_ICONS[type] ?? 'cafe-outline'}
            size={14}
            color={c.textTertiary}
          />
          <Text className="ml-2 text-xs font-sans-semibold text-text-tertiary uppercase tracking-widest">
            {typeLabel}
          </Text>
        </View>
        {items.length > 0 && (
          <Pressable
            onPress={handleSaveAsTemplate}
            className="flex-row items-center gap-1 px-2 py-1"
          >
            <Ionicons name="bookmark-outline" size={14} color="#38bdf8" />
            <Text className="text-xs font-sans-medium text-[#38bdf8]">Save</Text>
          </Pressable>
        )}
      </View>
      {items.map((item, idx) => (
        <View
          key={item.id}
          className="flex-row items-center justify-between py-2.5"
          style={idx > 0 ? { borderTopWidth: 1, borderTopColor: c.border } : undefined}
        >
          <View className="flex-row items-center gap-3 flex-1 mr-3">
            <View className="h-9 w-9 rounded-xl bg-surface-secondary items-center justify-center">
              <Text style={{ fontSize: 18 }}>🍽️</Text>
            </View>
            <Text className="text-sm font-sans-medium text-text flex-1" numberOfLines={1}>
              {item.snapshotFoodName}
            </Text>
          </View>
          <Text className="text-sm font-sans-bold text-text">{item.snapshotCalories} kcal</Text>
        </View>
      ))}
      {items.length > 1 && (
        <View
          className="flex-row justify-between pt-2 mt-1"
          style={{ borderTopWidth: 1, borderTopColor: c.border }}
        >
          <Text className="text-xs text-text-tertiary">Total</Text>
          <Text className="text-xs font-sans-semibold text-text">{totalCal} kcal</Text>
        </View>
      )}
    </View>
  );
}

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

interface StreakCalendarModalProps {
  visible: boolean;
  onClose: () => void;
  currentStreak: number;
  longestStreak: number;
  weekConsistency: number;
  monthConsistency: number;
  calendar: { date: string; logged: boolean }[];
}

function StreakCalendarModal({
  visible,
  onClose,
  currentStreak,
  longestStreak,
  weekConsistency,
  monthConsistency,
  calendar,
}: StreakCalendarModalProps) {
  const c = useColors();
  const { t } = useLocale();

  // Group calendar days by month for labelled sections
  const monthGroups: {
    label: string;
    days: { date: string; logged: boolean; dayNum: number }[];
  }[] = [];
  for (const day of calendar) {
    const d = new Date(day.date + 'T00:00:00');
    const label = `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`;
    let group = monthGroups.find((g) => g.label === label);
    if (!group) {
      group = { label, days: [] };
      monthGroups.push(group);
    }
    group.days.push({ date: day.date, logged: day.logged, dayNum: d.getDate() });
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1" style={{ backgroundColor: c.bg }}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 pt-5 pb-4">
          <Text style={{ fontSize: 20, fontFamily: 'Inter-Bold', color: c.text }}>
            {t('dashboard.streakCalendarTitle')}
          </Text>
          <Pressable
            onPress={onClose}
            className="h-9 w-9 rounded-full items-center justify-center"
            style={{ backgroundColor: c.card }}
          >
            <Ionicons name="close" size={18} color={c.text} />
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {/* Current streak + Longest streak */}
          <View className="flex-row gap-3 px-5 mb-5">
            <View
              className="flex-1 rounded-3xl p-4 items-center"
              style={{ backgroundColor: c.card }}
            >
              <Text style={{ fontSize: 36, fontFamily: 'Inter-Bold', color: '#f97316' }}>
                {currentStreak}
              </Text>
              <Text style={{ fontSize: 16 }}>🔥</Text>
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: 'Inter-Medium',
                  color: c.textTertiary,
                  marginTop: 2,
                  textAlign: 'center',
                }}
              >
                {t('dashboard.streak')}
              </Text>
            </View>
            <View
              className="flex-1 rounded-3xl p-4 items-center"
              style={{ backgroundColor: c.card }}
            >
              <Text style={{ fontSize: 36, fontFamily: 'Inter-Bold', color: c.text }}>
                {longestStreak}
              </Text>
              <Text style={{ fontSize: 16 }}>🏆</Text>
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: 'Inter-Medium',
                  color: c.textTertiary,
                  marginTop: 2,
                  textAlign: 'center',
                }}
              >
                {t('dashboard.streakLongest')}
              </Text>
            </View>
          </View>

          {/* Consistency bars */}
          <View className="mx-5 rounded-3xl p-4 mb-5" style={{ backgroundColor: c.card }}>
            <View className="mb-4">
              <View className="flex-row items-center justify-between mb-2">
                <Text style={{ fontSize: 13, fontFamily: 'Inter-SemiBold', color: c.text }}>
                  {t('dashboard.streakWeek')}
                </Text>
                <Text style={{ fontSize: 13, fontFamily: 'Inter-Bold', color: c.text }}>
                  {weekConsistency}%
                </Text>
              </View>
              <View
                className="h-2.5 rounded-full overflow-hidden"
                style={{ backgroundColor: c.cardAlt }}
              >
                <View
                  style={{
                    height: '100%',
                    width: `${weekConsistency}%`,
                    backgroundColor:
                      weekConsistency >= 80
                        ? '#22c55e'
                        : weekConsistency >= 50
                          ? '#f59e0b'
                          : '#ef4444',
                    borderRadius: 5,
                  }}
                />
              </View>
            </View>
            <View>
              <View className="flex-row items-center justify-between mb-2">
                <Text style={{ fontSize: 13, fontFamily: 'Inter-SemiBold', color: c.text }}>
                  {t('dashboard.streakMonth')}
                </Text>
                <Text style={{ fontSize: 13, fontFamily: 'Inter-Bold', color: c.text }}>
                  {monthConsistency}%
                </Text>
              </View>
              <View
                className="h-2.5 rounded-full overflow-hidden"
                style={{ backgroundColor: c.cardAlt }}
              >
                <View
                  style={{
                    height: '100%',
                    width: `${monthConsistency}%`,
                    backgroundColor:
                      monthConsistency >= 80
                        ? '#22c55e'
                        : monthConsistency >= 50
                          ? '#f59e0b'
                          : '#ef4444',
                    borderRadius: 5,
                  }}
                />
              </View>
            </View>
          </View>

          {/* Calendar groups by month */}
          {monthGroups.map((group) => (
            <View key={group.label} className="mx-5 mb-4">
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: 'Inter-SemiBold',
                  color: c.textTertiary,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}
              >
                {group.label}
              </Text>
              <View className="rounded-3xl p-4" style={{ backgroundColor: c.card }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {group.days.map((day) => (
                    <View
                      key={day.date}
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 8,
                        backgroundColor: day.logged ? '#22c55e' : '#2c2c2e',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontFamily: 'Inter-SemiBold',
                          color: day.logged ? '#ffffff' : '#52525b',
                        }}
                      >
                        {day.dayNum}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          ))}

          {/* Legend */}
          <View className="flex-row items-center justify-center gap-5 mt-2">
            <View className="flex-row items-center gap-2">
              <View
                style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: '#22c55e' }}
              />
              <Text style={{ fontSize: 12, fontFamily: 'Inter-Medium', color: c.textSecondary }}>
                Logged
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <View
                style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: c.cardAlt }}
              />
              <Text style={{ fontSize: 12, fontFamily: 'Inter-Medium', color: c.textSecondary }}>
                Missed
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

export function HomeScreen() {
  const { t } = useLocale();
  const c = useColors();
  const navigation = useNavigation();
  const { width: screenWidth } = useWindowDimensions();
  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  const [displayName, setDisplayName] = useState('');
  const [carouselPage, setCarouselPage] = useState(0);
  const [streakModalVisible, setStreakModalVisible] = useState(false);
  const [showEaten, setShowEaten] = useState(false);
  const { data: streakData, fetch: fetchStreaks } = useStreakStore();
  const { data, isLoading, fetchDashboard } = useDashboardStore();
  const { data: historyData, fetchHistory } = useNutritionHistoryStore();
  const history7 = historyData[7];
  const {
    consumed: waterConsumed,
    target: waterTarget,
    addWater,
    removeCup,
    fetchDaily: fetchWater,
  } = useWaterStore();
  const {
    steps,
    permissionStatus: stepsPermission,
    checkPermission: checkStepsPermission,
    requestPermission: requestStepsPermission,
    fetchTodaySteps,
  } = useStepsStore();
  const { summary: workoutSummary, fetchSummary: fetchWorkoutSummary } = useWorkoutStore();

  // 7 days: 5 past, today (6th), 1 future
  const weekDays = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(today, i - 5);
      return { date: d, key: toDateKey(d) };
    });
  }, []);

  const cellSize = Math.floor((screenWidth - 32) / 7);

  const loadProfile = useCallback(async () => {
    try {
      const res = await api.get<{ data: { displayName: string | null } }>('/profile');
      setDisplayName(res.data.displayName ?? '');
    } catch {
      setDisplayName('');
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useFocusEffect(
    useCallback(() => {
      fetchDashboard(selectedDateKey);
      fetchHistory(7);
      if (selectedDateKey === todayKey) {
        fetchWater();
        fetchStreaks();
        fetchWorkoutSummary();
      }
    }, [
      fetchDashboard,
      fetchWater,
      fetchStreaks,
      fetchHistory,
      fetchWorkoutSummary,
      selectedDateKey,
      todayKey,
    ]),
  );

  useEffect(() => {
    checkStepsPermission();
  }, [checkStepsPermission]);

  const onRefresh = useCallback(() => {
    loadProfile();
    fetchDashboard(selectedDateKey);
    fetchHistory(7);
    if (selectedDateKey === todayKey) {
      fetchWater();
      fetchTodaySteps();
      fetchStreaks();
    }
  }, [
    loadProfile,
    fetchDashboard,
    fetchWater,
    fetchTodaySteps,
    fetchStreaks,
    fetchHistory,
    selectedDateKey,
    todayKey,
  ]);

  const handleLogMeal = () => {
    (navigation as { navigate: (s: string) => void }).navigate('Log');
  };

  if (isLoading && !data) {
    return <HomeSkeleton />;
  }

  const targets = data?.targets ?? { calories: 2000, protein: 150, carbs: 200, fat: 65 };
  const consumed = data?.consumed ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const remaining = Math.max(targets.calories - consumed.calories, 0);
  const calProg = targets.calories > 0 ? Math.min(consumed.calories / targets.calories, 1) : 0;
  const proteinLeft = Math.max(Math.round(targets.protein - consumed.protein), 0);
  const carbsLeft = Math.max(Math.round(targets.carbs - consumed.carbs), 0);
  const fatLeft = Math.max(Math.round(targets.fat - consumed.fat), 0);
  const proteinProg = targets.protein > 0 ? Math.min(consumed.protein / targets.protein, 1) : 0;
  const carbsProg = targets.carbs > 0 ? Math.min(consumed.carbs / targets.carbs, 1) : 0;
  const fatProg = targets.fat > 0 ? Math.min(consumed.fat / targets.fat, 1) : 0;

  const mealsByType = (data?.meals ?? []).reduce<Record<string, DashboardMeal[]>>((acc, m) => {
    const type = m.mealType || 'snack';
    if (!acc[type]) acc[type] = [];
    acc[type].push(m);
    return acc;
  }, {});
  const mealOrder = ['breakfast', 'lunch', 'dinner', 'snack'];
  const hasMeals = mealOrder.some((t) => (mealsByType[t]?.length ?? 0) > 0);
  const isTodaySelected = selectedDateKey === todayKey;

  const effectiveWaterConsumed = isTodaySelected ? waterConsumed : (data?.waterConsumed ?? 0);
  const effectiveWaterTarget = data?.waterTarget ?? waterTarget;
  const waterProgress =
    effectiveWaterTarget > 0 ? Math.min(effectiveWaterConsumed / effectiveWaterTarget, 1) : 0;
  const waterCupsConsumed = effectiveWaterConsumed / CUP_ML;
  const waterCupsTarget = Math.round(effectiveWaterTarget / CUP_ML);
  const waterMlLabel =
    effectiveWaterConsumed >= 1000
      ? `${(effectiveWaterConsumed / 1000).toFixed(1)} L`
      : `${effectiveWaterConsumed} ml`;

  // Health score: calorie adherence (40 pts) + protein adherence (35 pts) + hydration (25 pts)
  const healthScore = (() => {
    if (!data?.targets || targets.calories === 0) return null;
    const calRatio = consumed.calories > 0 ? consumed.calories / targets.calories : 0;
    const calScore =
      calRatio === 0
        ? 0
        : calRatio <= 1.05
          ? Math.round(Math.min(calRatio, 1) * 40)
          : calRatio <= 1.15
            ? 35
            : calRatio <= 1.3
              ? 20
              : 10;
    const proteinRatio = targets.protein > 0 ? consumed.protein / targets.protein : 0;
    const proteinScore = Math.min(35, Math.round(proteinRatio * 35));
    const waterRatio = effectiveWaterTarget > 0 ? effectiveWaterConsumed / effectiveWaterTarget : 0;
    const waterScore = Math.min(25, Math.round(waterRatio * 25));
    return Math.min(100, Math.round(calScore + proteinScore + waterScore));
  })();

  const healthGrade =
    healthScore === null
      ? '–'
      : healthScore >= 90
        ? 'A'
        : healthScore >= 75
          ? 'B'
          : healthScore >= 60
            ? 'C'
            : healthScore >= 45
              ? 'D'
              : 'F';

  const healthColor =
    healthScore === null
      ? '#71717a'
      : healthScore >= 75
        ? '#22c55e'
        : healthScore >= 50
          ? '#f59e0b'
          : '#ef4444';

  const stepsProg = Math.min(steps / STEPS_GOAL, 1);
  const caloriesBurned = Math.round(steps * KCAL_PER_STEP);

  return (
    <View className="flex-1" style={{ backgroundColor: c.bg }}>
      <SafeAreaView edges={['top']}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 pt-3 pb-1">
          <View className="flex-row items-center gap-2.5">
            <View className="h-9 w-9 rounded-2xl bg-surface-secondary items-center justify-center">
              <Ionicons name="nutrition" size={20} color={c.text} />
            </View>
            <Text className="text-2xl font-sans-bold text-text">
              {displayName ? displayName : 'Coach'}
            </Text>
          </View>
          <Pressable
            onPress={() => setStreakModalVisible(true)}
            className="flex-row items-center gap-1.5 rounded-full px-4 py-2"
            style={{ backgroundColor: c.card }}
          >
            <Text style={{ fontSize: 15 }}>🔥</Text>
            <Text className="font-sans-bold text-text text-sm">
              {streakData?.currentStreak ?? 0}
            </Text>
          </Pressable>
        </View>

        {/* Week Calendar Strip with Calorie Rings */}
        <View className="px-4 pb-2 pt-1">
          <Text
            style={{
              fontSize: 11,
              fontFamily: 'Inter-SemiBold',
              color: c.textTertiary,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Text>
          <View style={{ flexDirection: 'row' }}>
            {weekDays.map(({ date, key }) => {
              const isSelected = selectedDateKey === key;
              const isToday = todayKey === key;
              const isPast = key < todayKey;
              const ringSize = Math.min(cellSize - 4, 44);
              const ringStroke = 3;
              const ringRadius = (ringSize - ringStroke) / 2;
              const ringCirc = 2 * Math.PI * ringRadius;

              // Get calorie data for this day from history
              const dayHistory = history7?.history?.find((h) => h.date === key);
              const dayTarget = history7?.target?.calories ?? targets.calories;
              const dayCals = dayHistory?.calories ?? 0;
              const dayRatio = dayTarget > 0 ? dayCals / dayTarget : 0;
              const hasData = dayCals > 0;
              const exceeded = dayRatio > 1;
              const ringProgress = Math.min(dayRatio, 1);

              // Ring color: green if on track, amber if >80%, red if exceeded
              const ringColor = !hasData
                ? 'transparent'
                : exceeded
                  ? '#ef4444'
                  : dayRatio >= 0.8
                    ? '#22c55e'
                    : dayRatio >= 0.5
                      ? '#f59e0b'
                      : '#3a3a3c';

              const trackColor = hasData ? '#2c2c2e' : '#1c1c1e';

              return (
                <Pressable
                  key={key}
                  onPress={() => setSelectedDateKey(key)}
                  style={{ width: cellSize, alignItems: 'center', paddingVertical: 2 }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontFamily: 'Inter-Medium',
                      color: isSelected || isToday ? '#ffffff' : isPast ? '#52525b' : '#3a3a3c',
                      marginBottom: 4,
                      letterSpacing: 0.3,
                    }}
                  >
                    {WEEKDAY_LABELS[date.getDay()]}
                  </Text>
                  <View
                    style={{
                      width: ringSize,
                      height: ringSize,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Svg
                      width={ringSize}
                      height={ringSize}
                      style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}
                    >
                      {/* Track circle */}
                      <Circle
                        cx={ringSize / 2}
                        cy={ringSize / 2}
                        r={ringRadius}
                        stroke={trackColor}
                        strokeWidth={ringStroke}
                        fill="none"
                      />
                      {/* Progress circle */}
                      {hasData && (
                        <Circle
                          cx={ringSize / 2}
                          cy={ringSize / 2}
                          r={ringRadius}
                          stroke={ringColor}
                          strokeWidth={ringStroke}
                          fill="none"
                          strokeDasharray={ringCirc}
                          strokeDashoffset={ringCirc * (1 - ringProgress)}
                          strokeLinecap="round"
                        />
                      )}
                    </Svg>
                    {/* Inner fill for selected state */}
                    <View
                      style={{
                        width: ringSize - ringStroke * 2 - 4,
                        height: ringSize - ringStroke * 2 - 4,
                        borderRadius: (ringSize - ringStroke * 2 - 4) / 2,
                        alignItems: 'center',
                        justifyContent: 'center',
                        ...(isSelected
                          ? { backgroundColor: c.text }
                          : isToday
                            ? { backgroundColor: c.card }
                            : {}),
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontFamily: isSelected || isToday ? 'Inter-Bold' : 'Inter-Medium',
                          color: isSelected
                            ? c.bg
                            : isToday
                              ? c.text
                              : isPast
                                ? c.textTertiary
                                : c.textSecondary,
                        }}
                      >
                        {date.getDate()}
                      </Text>
                    </View>
                    {/* Exceeded indicator: small dot below */}
                    {exceeded && (
                      <View
                        style={{
                          position: 'absolute',
                          bottom: -2,
                          width: 5,
                          height: 5,
                          borderRadius: 2.5,
                          backgroundColor: '#ef4444',
                        }}
                      />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100, paddingTop: 8 }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading && !!data}
            onRefresh={onRefresh}
            tintColor={c.text}
          />
        }
      >
        {/* ── Nutrition Carousel ── */}
        <Animated.View entering={FadeInDown.duration(350)} className="mb-1">
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onMomentumScrollEnd={(e) => {
              const newPage = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
              setCarouselPage(newPage);
            }}
          >
            {/* ── Page 0: Calories + Macros ── */}
            <View style={{ width: screenWidth, paddingHorizontal: 16 }}>
              {/* Calorie Card */}
              <Pressable
                onPress={() => setShowEaten((v) => !v)}
                className="rounded-3xl p-4 mb-3"
                style={{ backgroundColor: c.card }}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 mr-2">
                    {showEaten ? (
                      <View className="flex-row items-baseline">
                        <Text className="text-5xl font-sans-bold text-text leading-none">
                          {consumed.calories}
                        </Text>
                        <Text className="text-2xl font-sans-medium text-text-tertiary leading-none">
                          {' '}
                          /{targets.calories}
                        </Text>
                      </View>
                    ) : (
                      <Text className="text-5xl font-sans-bold text-text leading-none">
                        {remaining}
                      </Text>
                    )}
                    <Text className="text-sm text-text-tertiary font-sans-medium mt-1.5">
                      {showEaten ? t('dashboard.caloriesEaten') : t('dashboard.caloriesLeft')}{' '}
                      &#x25C7;
                    </Text>
                    <View className="flex-row items-center gap-3 mt-2.5">
                      <View className="flex-row items-center gap-1.5">
                        <View className="h-2 w-2 rounded-full bg-[#f97316]" />
                        <Text className="text-xs text-text-tertiary font-sans-medium">
                          +{consumed.calories} {t('dashboard.eaten')}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-1.5">
                        <View className="h-2 w-2 rounded-full bg-surface-muted" />
                        <Text className="text-xs text-text-tertiary font-sans-medium">
                          {targets.calories} goal
                        </Text>
                      </View>
                    </View>
                  </View>
                  <ProgressArc progress={calProg} size={80} strokeWidth={7} color={c.text}>
                    <Text style={{ fontSize: 26 }}>🔥</Text>
                  </ProgressArc>
                </View>
              </Pressable>

              {/* Macro Cards */}
              <View className="flex-row gap-3">
                <MacroCard
                  label={t('dashboard.protein')}
                  leftAmount={proteinLeft}
                  eatenAmount={Math.round(consumed.protein)}
                  targetAmount={Math.round(targets.protein)}
                  unit="g"
                  progress={proteinProg}
                  color="#f97316"
                  icon="🍗"
                  showEaten={showEaten}
                  onToggle={() => setShowEaten((v) => !v)}
                />
                <MacroCard
                  label={t('dashboard.carbs')}
                  leftAmount={carbsLeft}
                  eatenAmount={Math.round(consumed.carbs)}
                  targetAmount={Math.round(targets.carbs)}
                  unit="g"
                  progress={carbsProg}
                  color="#f59e0b"
                  icon="🌾"
                  showEaten={showEaten}
                  onToggle={() => setShowEaten((v) => !v)}
                />
                <MacroCard
                  label={t('dashboard.fat')}
                  leftAmount={fatLeft}
                  eatenAmount={Math.round(consumed.fat)}
                  targetAmount={Math.round(targets.fat)}
                  unit="g"
                  progress={fatProg}
                  color="#3b82f6"
                  icon="🫐"
                  showEaten={showEaten}
                  onToggle={() => setShowEaten((v) => !v)}
                />
              </View>
            </View>

            {/* ── Page 1: Health Score + Water + Nutrients ── */}
            <View style={{ width: screenWidth, paddingHorizontal: 16 }}>
              {/* Row 1: Health Score card (flex-[2]) + Water quick-info (flex-1) */}
              <View className="flex-row gap-3 mb-3">
                {/* Health Score */}
                <View className="flex-[2] rounded-3xl p-4" style={{ backgroundColor: c.card }}>
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 mr-2">
                      <Text
                        style={{
                          fontSize: 44,
                          fontFamily: 'Inter-Bold',
                          color: healthColor,
                          lineHeight: 48,
                        }}
                      >
                        {healthScore ?? '–'}
                      </Text>
                      <Text className="text-sm text-text-tertiary font-sans-medium mt-1">
                        {t('dashboard.healthScore')}
                      </Text>
                      <View className="flex-row items-center gap-2 mt-2.5">
                        <View
                          className="px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: healthColor + '20' }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              fontFamily: 'Inter-Bold',
                              color: healthColor,
                            }}
                          >
                            {healthGrade}
                          </Text>
                        </View>
                        <Text className="text-xs text-text-tertiary font-sans-medium">/ 100</Text>
                      </View>
                    </View>
                    <ProgressArc
                      progress={healthScore !== null ? healthScore / 100 : 0}
                      size={80}
                      strokeWidth={7}
                      color={healthColor}
                      trackColor={healthColor + '20'}
                    >
                      <Text style={{ fontSize: 26 }}>💪</Text>
                    </ProgressArc>
                  </View>
                </View>

                {/* Water Summary + Controls */}
                <View
                  className="flex-1 rounded-3xl p-4 justify-between"
                  style={{ backgroundColor: c.card }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontFamily: 'Inter-SemiBold',
                      color: c.textTertiary,
                      letterSpacing: 0.8,
                      textTransform: 'uppercase',
                    }}
                  >
                    {t('dashboard.water')}
                  </Text>
                  <View className="items-center" style={{ marginVertical: 4 }}>
                    <ProgressArc
                      progress={waterProgress}
                      size={52}
                      strokeWidth={5}
                      color="#0ea5e9"
                      trackColor="#0c4a6e"
                    >
                      <Text style={{ fontSize: 14 }}>💧</Text>
                    </ProgressArc>
                    <Text
                      style={{
                        fontSize: 16,
                        fontFamily: 'Inter-Bold',
                        color: c.text,
                        marginTop: 4,
                      }}
                    >
                      {waterCupsConsumed.toFixed(1)}
                    </Text>
                    <Text
                      style={{ fontSize: 9, fontFamily: 'Inter-Medium', color: c.textTertiary }}
                    >
                      {t('dashboard.waterCups')} · {waterMlLabel}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Pressable
                      onPress={() => removeCup(CUP_ML)}
                      disabled={effectiveWaterConsumed <= 0}
                      className="flex-1 h-8 rounded-xl items-center justify-center"
                      style={{ backgroundColor: c.cardAlt }}
                    >
                      <Ionicons
                        name="remove"
                        size={18}
                        color={effectiveWaterConsumed <= 0 ? '#3a3a3c' : '#ffffff'}
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => addWater(CUP_ML)}
                      className="flex-1 h-8 rounded-xl bg-[#0ea5e9] items-center justify-center"
                    >
                      <Ionicons name="add" size={18} color={c.text} />
                    </Pressable>
                  </View>
                </View>
              </View>

              {/* Row 3: Fiber / Sugar / Sodium (coming soon) */}
              <View className="flex-row gap-3">
                <NutrientMiniCard
                  label={t('dashboard.fiber')}
                  value="–"
                  unit="g"
                  color="#22c55e"
                  icon="🥦"
                  sublabel={t('dashboard.comingSoon')}
                />
                <NutrientMiniCard
                  label={t('dashboard.sugar')}
                  value="–"
                  unit="g"
                  color="#ec4899"
                  icon="🍬"
                  sublabel={t('dashboard.comingSoon')}
                />
                <NutrientMiniCard
                  label={t('dashboard.sodium')}
                  value="–"
                  unit="mg"
                  color="#8b5cf6"
                  icon="🧂"
                  sublabel={t('dashboard.comingSoon')}
                />
              </View>
            </View>

            {/* ── Page 2: Steps ── */}
            <View style={{ width: screenWidth, paddingHorizontal: 16 }}>
              <View className="flex-row gap-3">
                {/* Left: Steps card or Connect prompt */}
                {stepsPermission === 'granted' ? (
                  <View className="flex-[2] rounded-3xl p-4" style={{ backgroundColor: c.card }}>
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1 mr-2">
                        <Text
                          style={{
                            fontSize: 44,
                            fontFamily: 'Inter-Bold',
                            color: c.text,
                            lineHeight: 48,
                          }}
                        >
                          {steps.toLocaleString()}
                        </Text>
                        <Text className="text-sm text-text-tertiary font-sans-medium mt-1">
                          {t('dashboard.steps')}
                        </Text>
                        <Text
                          style={{
                            fontSize: 11,
                            fontFamily: 'Inter-Medium',
                            color: c.textTertiary,
                            marginTop: 6,
                          }}
                        >
                          / {STEPS_GOAL.toLocaleString()} {t('dashboard.stepsGoal')}
                        </Text>
                      </View>
                      <ProgressArc
                        progress={stepsProg}
                        size={80}
                        strokeWidth={7}
                        color={c.text}
                        trackColor="#2c2c2e"
                      >
                        <Text style={{ fontSize: 22 }}>🚶</Text>
                      </ProgressArc>
                    </View>
                  </View>
                ) : (
                  <View
                    className="flex-[2] rounded-3xl p-4 items-center justify-center"
                    style={{ backgroundColor: c.card }}
                  >
                    <View
                      className="w-12 h-12 rounded-2xl items-center justify-center mb-2"
                      style={{ backgroundColor: c.cardAlt }}
                    >
                      <Text style={{ fontSize: 24 }}>❤️</Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 14,
                        fontFamily: 'Inter-Bold',
                        color: c.text,
                        textAlign: 'center',
                        marginBottom: 2,
                      }}
                    >
                      {t('dashboard.connectHealth')}
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        fontFamily: 'Inter-Medium',
                        color: c.textTertiary,
                        textAlign: 'center',
                        marginBottom: 12,
                      }}
                    >
                      {t('dashboard.trackSteps')}
                    </Text>
                    <Pressable
                      onPress={requestStepsPermission}
                      className="bg-primary-500 px-5 py-2 rounded-full"
                    >
                      <Text className="text-on-primary font-sans-semibold text-[13px]">
                        {t('dashboard.connect')}
                      </Text>
                    </Pressable>
                  </View>
                )}

                {/* Right: Calories burned */}
                <View
                  className="flex-1 rounded-3xl p-4 justify-between"
                  style={{ backgroundColor: c.card }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontFamily: 'Inter-SemiBold',
                      color: c.textTertiary,
                      letterSpacing: 0.8,
                      textTransform: 'uppercase',
                    }}
                  >
                    {t('dashboard.caloriesBurned')}
                  </Text>
                  <View>
                    <Text
                      style={{
                        fontSize: 20,
                        fontFamily: 'Inter-Bold',
                        color: c.text,
                        lineHeight: 24,
                      }}
                    >
                      {caloriesBurned}
                    </Text>
                    <Text
                      style={{ fontSize: 10, fontFamily: 'Inter-Medium', color: c.textTertiary }}
                    >
                      cal
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <Text style={{ fontSize: 16 }}>🚶</Text>
                    <View>
                      <Text style={{ fontSize: 11, fontFamily: 'Inter-SemiBold', color: c.text }}>
                        {t('dashboard.steps')}
                      </Text>
                      <Text
                        style={{ fontSize: 10, fontFamily: 'Inter-Medium', color: c.textTertiary }}
                      >
                        {caloriesBurned} cal
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* ── Page 3: Streak & Consistency ── */}
            <View style={{ width: screenWidth, paddingHorizontal: 16 }}>
              {/* Row 1: Current streak + Longest streak */}
              <View className="flex-row gap-3 mb-3">
                {/* Current streak — hero card */}
                <Pressable
                  className="flex-[2] rounded-3xl p-4"
                  style={{ backgroundColor: c.card }}
                  onPress={() => setStreakModalVisible(true)}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 mr-2">
                      <Text
                        style={{
                          fontSize: 44,
                          fontFamily: 'Inter-Bold',
                          color: (streakData?.currentStreak ?? 0) > 0 ? '#f97316' : '#ffffff',
                          lineHeight: 48,
                        }}
                      >
                        {streakData?.currentStreak ?? 0}
                      </Text>
                      <Text className="text-sm text-text-tertiary font-sans-medium mt-1">
                        {t('dashboard.streak')}
                      </Text>
                      <View className="flex-row items-center gap-2 mt-2.5">
                        <View
                          className="px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: streakData?.todayLogged ? '#22c55e20' : '#2c2c2e',
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              fontFamily: 'Inter-Bold',
                              color: streakData?.todayLogged ? '#22c55e' : '#71717a',
                            }}
                          >
                            {streakData?.todayLogged ? '✓ Today' : '– Today'}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <ProgressArc
                      progress={
                        streakData && streakData.longestStreak > 0
                          ? Math.min((streakData.currentStreak ?? 0) / streakData.longestStreak, 1)
                          : 0
                      }
                      size={80}
                      strokeWidth={7}
                      color="#f97316"
                      trackColor="#f9731620"
                    >
                      <Text style={{ fontSize: 26 }}>🔥</Text>
                    </ProgressArc>
                  </View>
                </Pressable>

                {/* Best streak */}
                <View
                  className="flex-1 rounded-3xl p-4 justify-between"
                  style={{ backgroundColor: c.card }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontFamily: 'Inter-SemiBold',
                      color: c.textTertiary,
                      letterSpacing: 0.8,
                      textTransform: 'uppercase',
                    }}
                  >
                    {t('dashboard.streakLongest')}
                  </Text>
                  <View>
                    <Text
                      style={{
                        fontSize: 20,
                        fontFamily: 'Inter-Bold',
                        color: c.text,
                        lineHeight: 24,
                      }}
                    >
                      {streakData?.longestStreak ?? 0}
                    </Text>
                    <Text
                      style={{ fontSize: 10, fontFamily: 'Inter-Medium', color: c.textTertiary }}
                    >
                      {t('dashboard.streakDays')}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 22 }}>🏆</Text>
                </View>
              </View>

              {/* Row 2: Consistency bars */}
              <View className="rounded-3xl p-4 mb-3" style={{ backgroundColor: c.card }}>
                {/* 7-day */}
                <View className="mb-3">
                  <View className="flex-row items-center justify-between mb-1.5">
                    <Text style={{ fontSize: 12, fontFamily: 'Inter-SemiBold', color: c.text }}>
                      {t('dashboard.streakWeek')}
                    </Text>
                    <Text style={{ fontSize: 12, fontFamily: 'Inter-Bold', color: c.text }}>
                      {streakData?.weekConsistency ?? 0}%
                    </Text>
                  </View>
                  <View
                    className="h-2 rounded-full overflow-hidden"
                    style={{ backgroundColor: c.cardAlt }}
                  >
                    <View
                      style={{
                        height: '100%',
                        width: `${streakData?.weekConsistency ?? 0}%`,
                        backgroundColor:
                          (streakData?.weekConsistency ?? 0) >= 80
                            ? '#22c55e'
                            : (streakData?.weekConsistency ?? 0) >= 50
                              ? '#f59e0b'
                              : '#ef4444',
                        borderRadius: 4,
                      }}
                    />
                  </View>
                </View>
                {/* 30-day */}
                <View>
                  <View className="flex-row items-center justify-between mb-1.5">
                    <Text style={{ fontSize: 12, fontFamily: 'Inter-SemiBold', color: c.text }}>
                      {t('dashboard.streakMonth')}
                    </Text>
                    <Text style={{ fontSize: 12, fontFamily: 'Inter-Bold', color: c.text }}>
                      {streakData?.monthConsistency ?? 0}%
                    </Text>
                  </View>
                  <View
                    className="h-2 rounded-full overflow-hidden"
                    style={{ backgroundColor: c.cardAlt }}
                  >
                    <View
                      style={{
                        height: '100%',
                        width: `${streakData?.monthConsistency ?? 0}%`,
                        backgroundColor:
                          (streakData?.monthConsistency ?? 0) >= 80
                            ? '#22c55e'
                            : (streakData?.monthConsistency ?? 0) >= 50
                              ? '#f59e0b'
                              : '#ef4444',
                        borderRadius: 4,
                      }}
                    />
                  </View>
                </View>
              </View>

              {/* Row 3: Workouts */}
              <Pressable
                className="rounded-3xl p-4"
                style={{ backgroundColor: c.card }}
                onPress={() =>
                  (navigation as { navigate: (s: string, p?: object) => void }).navigate(
                    'WorkoutHome',
                  )
                }
              >
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text
                      style={{ fontSize: 12, fontFamily: 'Inter-SemiBold', color: c.textTertiary }}
                    >
                      {t('dashboard.workouts')}
                    </Text>
                    <Text
                      style={{
                        fontSize: 28,
                        fontFamily: 'Inter-Bold',
                        color: c.text,
                        marginTop: 2,
                      }}
                    >
                      {workoutSummary?.workoutCount ?? 0}
                    </Text>
                    <Text
                      style={{ fontSize: 11, fontFamily: 'Inter-Medium', color: c.textTertiary }}
                    >
                      {t('dashboard.thisWeek')}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-3">
                    <View className="items-center">
                      <Text style={{ fontSize: 18, fontFamily: 'Inter-Bold', color: '#f97316' }}>
                        {workoutSummary?.totalDurationMin ?? 0}
                      </Text>
                      <Text
                        style={{ fontSize: 10, fontFamily: 'Inter-Medium', color: c.textTertiary }}
                      >
                        min
                      </Text>
                    </View>
                    <View className="items-center">
                      <Text style={{ fontSize: 18, fontFamily: 'Inter-Bold', color: '#22c55e' }}>
                        {workoutSummary?.totalCaloriesBurned ?? 0}
                      </Text>
                      <Text
                        style={{ fontSize: 10, fontFamily: 'Inter-Medium', color: c.textTertiary }}
                      >
                        cal
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={c.textTertiary} />
                  </View>
                </View>
              </Pressable>
            </View>
          </ScrollView>

          {/* Carousel Dots */}
          <View className="flex-row items-center justify-center gap-1.5 mt-3 mb-1">
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={{
                  width: carouselPage === i ? 16 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: carouselPage === i ? '#ffffff' : '#3a3a3c',
                }}
              />
            ))}
          </View>
        </Animated.View>

        {/* ── 7-Day History Chart ── */}
        {history7?.history && history7.history.length > 0 && (
          <Animated.View entering={FadeInDown.duration(350).delay(100)} className="px-4 mb-4">
            <View className="rounded-3xl p-4" style={{ backgroundColor: c.card }}>
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: 'Inter-SemiBold',
                  color: c.textTertiary,
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                  marginBottom: 12,
                }}
              >
                {t('dashboard.weekHistory')}
              </Text>
              <HistoryBarChart
                history={history7.history}
                targetCalories={history7.target?.calories ?? null}
                onDayPress={setSelectedDateKey}
                selectedDateKey={selectedDateKey}
              />
            </View>
          </Animated.View>
        )}

        {/* ── Meals Today ── */}
        <Animated.View entering={FadeInDown.duration(350).delay(150)} className="px-4">
          <Text
            style={{
              fontSize: 11,
              fontFamily: 'Inter-SemiBold',
              color: c.textTertiary,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              marginBottom: 10,
            }}
          >
            {t('dashboard.mealsToday')}
          </Text>
          {hasMeals ? (
            mealOrder
              .filter((mt) => (mealsByType[mt]?.length ?? 0) > 0)
              .map((mt) => (
                <MealSection
                  key={mt}
                  type={mt}
                  meals={mealsByType[mt]}
                  typeLabel={t(MEAL_TYPE_LABELS[mt] ?? mt)}
                />
              ))
          ) : (
            <Pressable
              onPress={handleLogMeal}
              className="rounded-3xl p-6 items-center"
              style={{ backgroundColor: c.card }}
            >
              <View
                className="h-12 w-12 rounded-2xl items-center justify-center mb-3"
                style={{ backgroundColor: c.cardAlt }}
              >
                <Ionicons name="restaurant-outline" size={22} color={c.textTertiary} />
              </View>
              <Text className="text-sm font-sans-semibold text-text mb-1">
                {t('dashboard.noMeals')}
              </Text>
              <Text className="text-xs text-text-tertiary text-center">
                {t('dashboard.tapToLog')}
              </Text>
            </Pressable>
          )}
        </Animated.View>
      </ScrollView>

      {/* Streak Calendar Modal */}
      <StreakCalendarModal
        visible={streakModalVisible}
        onClose={() => setStreakModalVisible(false)}
        currentStreak={streakData?.currentStreak ?? 0}
        longestStreak={streakData?.longestStreak ?? 0}
        weekConsistency={streakData?.weekConsistency ?? 0}
        monthConsistency={streakData?.monthConsistency ?? 0}
        calendar={streakData?.calendar ?? []}
      />
    </View>
  );
}

function HomeSkeleton() {
  const c = useColors();
  return (
    <View className="flex-1" style={{ backgroundColor: c.bg }}>
      <SafeAreaView edges={['top']}>
        <View className="px-5 pt-3 pb-3">
          <SkeletonLoader width={140} height={28} borderRadius={8} />
        </View>
      </SafeAreaView>
      <View className="px-4 pt-2">
        <SkeletonLoader width="100%" height={160} borderRadius={24} />
        <View className="flex-row gap-3 mt-3">
          <SkeletonLoader width="33%" height={120} borderRadius={24} />
          <SkeletonLoader width="33%" height={120} borderRadius={24} />
          <SkeletonLoader width="33%" height={120} borderRadius={24} />
        </View>
      </View>
    </View>
  );
}
