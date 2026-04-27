import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  useWindowDimensions,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  Easing,
  FadeInDown,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { SkeletonLoader } from '../components/ui';
import { useDashboardStore, type DashboardMeal } from '../stores/dashboard.store';
import { useWaterStore } from '../stores/water.store';
import { useStepsStore, STEPS_GOAL, KCAL_PER_STEP } from '../stores/steps.store';
import { useStreakStore } from '../stores/streak.store';
import { useWorkoutStore } from '../stores/workout.store';
import { api } from '../api';
import { useLocale } from '../i18n';
import { useColors } from '../theme';
import { getDeviceTimezone } from '../utils/timezone';

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
const CALENDAR_WEEKS = 5; // ~1 month of swipable history

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
    anim.value = withTiming(Math.min(Math.max(progress, 0), 1), {
      duration: 600,
      easing: Easing.out(Easing.cubic),
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
  testID?: string;
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
  testID,
}: MacroCardProps) {
  const c = useColors();
  const { t } = useLocale();
  return (
    <Pressable
      testID={testID}
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
  const { t } = useLocale();
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
            <Ionicons name="bookmark-outline" size={14} color={c.primaryMuted} />
            <Text className="text-xs font-sans-medium" style={{ color: c.primaryMuted }}>
              {t('progressTab.save')}
            </Text>
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
              <Text style={{ fontSize: 36, fontFamily: 'Inter-Bold', color: c.warning }}>
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
                        ? c.success
                        : weekConsistency >= 50
                          ? c.warning
                          : c.danger,
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
                        ? c.success
                        : monthConsistency >= 50
                          ? c.warning
                          : c.danger,
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
                        backgroundColor: day.logged ? c.success : c.cardAlt,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontFamily: 'Inter-SemiBold',
                          color: day.logged ? c.onPrimary : c.textTertiary,
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
                style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: c.success }}
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
  const [showMicronutrients, setShowMicronutrients] = useState(false);
  const [weekHistory, setWeekHistory] = useState<Map<string, number>>(new Map());
  const [weekCalorieTarget, setWeekCalorieTarget] = useState<number | null>(null);
  const [telegramLinked, setTelegramLinked] = useState<boolean | null>(null);
  const { data: streakData, fetch: fetchStreaks } = useStreakStore();
  const { data, isLoading, fetchDashboard, loadCachedDashboard } = useDashboardStore();
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

  const insets = useSafeAreaInsets();
  const calendarRef = useRef<ScrollView>(null);

  // Generate weeks where today is always at the 6th position (index 5)
  const calendarWeeks = useMemo(() => {
    const today = new Date();
    const weeks: { date: Date; key: string }[][] = [];
    for (let w = -(CALENDAR_WEEKS - 1); w <= 0; w++) {
      const days: { date: Date; key: string }[] = [];
      for (let d = -5; d <= 1; d++) {
        const date = addDays(today, w * 7 + d);
        days.push({ date, key: toDateKey(date) });
      }
      weeks.push(days);
    }
    return weeks;
  }, []);

  // Scroll calendar to current week on mount
  useEffect(() => {
    setTimeout(() => {
      calendarRef.current?.scrollToEnd({ animated: false });
    }, 50);
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      const res = await api.get<{ data: { displayName: string | null } }>('/profile');
      setDisplayName(res.data.displayName ?? '');
    } catch {
      setDisplayName('');
    }
  }, []);

  const loadTelegramStatus = useCallback(async () => {
    try {
      const res = await api.get<{ linked: boolean }>('/telegram/status');
      setTelegramLinked(res.linked);
    } catch {
      // keep null — don't show CTA if we can't determine status
    }
  }, []);

  const loadWeekHistory = useCallback(async () => {
    try {
      const res = await api.get<{
        data: {
          history: { date: string; calories: number }[];
          target: { calories: number } | null;
        };
      }>(`/dashboard/history?days=35&tz=${encodeURIComponent(getDeviceTimezone())}`);
      const map = new Map<string, number>();
      for (const day of res.data.history) {
        map.set(day.date, day.calories);
      }
      setWeekHistory(map);
      if (res.data.target) {
        setWeekCalorieTarget(res.data.target.calories);
      }
    } catch {
      /* keep previous state */
    }
  }, []);

  useEffect(() => {
    loadCachedDashboard();
    loadProfile();
    loadWeekHistory();
    void loadTelegramStatus();
  }, [loadCachedDashboard, loadProfile, loadWeekHistory, loadTelegramStatus]);

  useFocusEffect(
    useCallback(() => {
      // `cancelled` guards against stale responses overwriting fresh local state when
      // the user rapidly switches away and back before in-flight requests complete.
      // Zustand store actions use internal set() so last-write-wins is acceptable there;
      // the flag specifically protects the local setWeekHistory / setWeekCalorieTarget
      // calls inside loadWeekHistory from applying after a newer focus cycle has started.
      let cancelled = false;

      const loadWeekHistoryGuarded = async () => {
        try {
          const res = await api.get<{
            data: {
              history: { date: string; calories: number }[];
              target: { calories: number } | null;
            };
          }>(`/dashboard/history?days=35&tz=${encodeURIComponent(getDeviceTimezone())}`);
          if (cancelled) return;
          const map = new Map<string, number>();
          for (const day of res.data.history) {
            map.set(day.date, day.calories);
          }
          setWeekHistory(map);
          if (res.data.target) {
            setWeekCalorieTarget(res.data.target.calories);
          }
        } catch {
          /* keep previous state */
        }
      };

      fetchDashboard(selectedDateKey);
      loadWeekHistoryGuarded();
      if (selectedDateKey === todayKey) {
        fetchWater();
        fetchStreaks();
        fetchWorkoutSummary();
      }

      return () => {
        cancelled = true;
      };
    }, [fetchDashboard, fetchWater, fetchStreaks, fetchWorkoutSummary, selectedDateKey, todayKey]),
  );

  useEffect(() => {
    checkStepsPermission();
  }, [checkStepsPermission]);

  const onRefresh = useCallback(() => {
    loadProfile();
    fetchDashboard(selectedDateKey);
    loadWeekHistory();
    if (selectedDateKey === todayKey) {
      fetchWater();
      fetchTodaySteps();
      fetchStreaks();
    }
  }, [
    loadProfile,
    fetchDashboard,
    loadWeekHistory,
    fetchWater,
    fetchTodaySteps,
    fetchStreaks,
    selectedDateKey,
    todayKey,
  ]);

  const handleLogMeal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    (navigation as { navigate: (s: string) => void }).navigate('Log');
  };

  if (isLoading && !data) {
    return <HomeSkeleton />;
  }

  const targets = data?.targets ?? null;
  const consumed = data?.consumed ?? {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: null,
    sugar: null,
    sodium: null,
    saturatedFat: null,
  };
  const hasTargets = targets !== null;
  const remaining = hasTargets ? Math.max(targets.calories - consumed.calories, 0) : 0;
  const calProg =
    hasTargets && targets.calories > 0 ? Math.min(consumed.calories / targets.calories, 1) : 0;
  const proteinLeft = hasTargets ? Math.max(Math.round(targets.protein - consumed.protein), 0) : 0;
  const carbsLeft = hasTargets ? Math.max(Math.round(targets.carbs - consumed.carbs), 0) : 0;
  const fatLeft = hasTargets ? Math.max(Math.round(targets.fat - consumed.fat), 0) : 0;
  const proteinProg =
    hasTargets && targets.protein > 0 ? Math.min(consumed.protein / targets.protein, 1) : 0;
  const carbsProg =
    hasTargets && targets.carbs > 0 ? Math.min(consumed.carbs / targets.carbs, 1) : 0;
  const fatProg = hasTargets && targets.fat > 0 ? Math.min(consumed.fat / targets.fat, 1) : 0;

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
  const _waterCupsTarget = Math.round(effectiveWaterTarget / CUP_ML);
  const waterMlLabel =
    effectiveWaterConsumed >= 1000
      ? `${(effectiveWaterConsumed / 1000).toFixed(1)} L`
      : `${effectiveWaterConsumed} ml`;

  // Health score: calorie adherence (40 pts) + protein adherence (35 pts) + hydration (25 pts)
  const healthScore = (() => {
    if (!hasTargets || !targets || targets.calories === 0) return null;
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
      ? c.textTertiary
      : healthScore >= 75
        ? c.success
        : healthScore >= 50
          ? c.warning
          : c.danger;

  const stepsProg = Math.min(steps / STEPS_GOAL, 1);
  const caloriesBurned = Math.round(steps * KCAL_PER_STEP);

  return (
    <View className="flex-1" style={{ backgroundColor: c.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100, paddingTop: insets.top }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading && !!data}
            onRefresh={onRefresh}
            tintColor={c.text}
          />
        }
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 pt-4 pb-3">
          <View className="flex-row items-center gap-2">
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

        {/* Swipable Week Calendar */}
        <View className="pb-4 pt-1">
          <ScrollView
            ref={calendarRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
          >
            {calendarWeeks.map((week, weekIdx) => (
              <View
                key={weekIdx}
                style={{ width: screenWidth, flexDirection: 'row', paddingHorizontal: 16 }}
              >
                {week.map(({ date, key }) => {
                  const isSelected = selectedDateKey === key;
                  const isToday = todayKey === key;
                  const isFuture = key > todayKey;
                  const circleSize = 40;

                  // Determine ring color based on calorie proximity to goal
                  const dayCals = weekHistory.get(key);
                  const calTarget = weekCalorieTarget ?? targets?.calories ?? null;
                  let ringColor: string | null = null;
                  let dayHasMeals = false;

                  if (!isFuture && dayCals !== undefined && dayCals > 0) {
                    dayHasMeals = true;
                    if (calTarget !== null) {
                      const diff = Math.abs(dayCals - calTarget);
                      if (diff <= 200) {
                        ringColor = c.success; // green
                      } else if (diff <= 500) {
                        ringColor = c.warning; // yellow
                      } else {
                        ringColor = c.danger; // red
                      }
                    }
                  }

                  return (
                    <Pressable
                      key={key}
                      onPress={() => setSelectedDateKey(key)}
                      style={{ flex: 1, alignItems: 'center', paddingVertical: 2 }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontFamily: 'Inter-Medium',
                          color: isSelected || isToday ? c.text : c.textTertiary,
                          marginBottom: 6,
                        }}
                      >
                        {WEEKDAY_LABELS[date.getDay()]}
                      </Text>
                      <View
                        style={{
                          width: circleSize,
                          height: circleSize,
                          borderRadius: circleSize / 2,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: isSelected ? c.text : isToday ? c.card : 'transparent',
                          ...(!(isSelected || isToday) &&
                            (dayHasMeals && ringColor
                              ? {
                                  borderWidth: 2,
                                  borderColor: ringColor,
                                  borderStyle: 'solid' as const,
                                }
                              : {
                                  borderWidth: 1.5,
                                  borderColor: isFuture ? c.border : c.textTertiary,
                                  borderStyle: 'dashed' as const,
                                })),
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 14,
                            fontFamily: isSelected || isToday ? 'Inter-Bold' : 'Inter-Medium',
                            color: isSelected
                              ? c.bg
                              : isToday || dayHasMeals
                                ? c.text
                                : c.textTertiary,
                          }}
                        >
                          {date.getDate()}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </View>

        {/* ── Nutrition Carousel ── */}
        <Animated.View entering={FadeInDown.duration(350)} className="mb-4">
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
                testID="calorie-card"
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
                        {hasTargets && (
                          <Text className="text-2xl font-sans-medium text-text-tertiary leading-none">
                            {' '}
                            /{targets.calories}
                          </Text>
                        )}
                      </View>
                    ) : hasTargets ? (
                      <Text className="text-5xl font-sans-bold text-text leading-none">
                        {remaining}
                      </Text>
                    ) : (
                      <Text className="text-5xl font-sans-bold text-text leading-none">
                        {consumed.calories}
                      </Text>
                    )}
                    <Text className="text-sm text-text-tertiary font-sans-medium mt-1.5">
                      {!hasTargets
                        ? t('dashboard.caloriesEaten')
                        : showEaten
                          ? t('dashboard.caloriesEaten')
                          : t('dashboard.caloriesLeft')}{' '}
                      {hasTargets && '◇'}
                    </Text>
                    <View className="flex-row items-center gap-2 mt-2.5">
                      <View
                        className="flex-row items-center gap-1 px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: c.cardAlt }}
                      >
                        <Ionicons name="time-outline" size={13} color={c.textTertiary} />
                        <Text className="text-xs font-sans-semibold text-text-tertiary">
                          +{caloriesBurned}
                        </Text>
                      </View>
                      <View
                        className="flex-row items-center gap-1 px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: c.cardAlt }}
                      >
                        <Ionicons name="restaurant-outline" size={13} color={c.textTertiary} />
                        <Text className="text-xs font-sans-semibold text-text-tertiary">
                          +{workoutSummary?.totalCaloriesBurned ?? 0}
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
                  testID="macro-protein"
                  label={t('dashboard.protein')}
                  leftAmount={proteinLeft}
                  eatenAmount={Math.round(consumed.protein)}
                  targetAmount={hasTargets ? Math.round(targets.protein) : 0}
                  unit="g"
                  progress={proteinProg}
                  color={c.warning}
                  icon="🍗"
                  showEaten={showEaten}
                  onToggle={() => setShowEaten((v) => !v)}
                />
                <MacroCard
                  testID="macro-carbs"
                  label={t('dashboard.carbs')}
                  leftAmount={carbsLeft}
                  eatenAmount={Math.round(consumed.carbs)}
                  targetAmount={hasTargets ? Math.round(targets.carbs) : 0}
                  unit="g"
                  progress={carbsProg}
                  color={c.warning}
                  icon="🌾"
                  showEaten={showEaten}
                  onToggle={() => setShowEaten((v) => !v)}
                />
                <MacroCard
                  testID="macro-fat"
                  label={t('dashboard.fat')}
                  leftAmount={fatLeft}
                  eatenAmount={Math.round(consumed.fat)}
                  targetAmount={hasTargets ? Math.round(targets.fat) : 0}
                  unit="g"
                  progress={fatProg}
                  color={c.primaryMuted}
                  icon="🫐"
                  showEaten={showEaten}
                  onToggle={() => setShowEaten((v) => !v)}
                />
              </View>

              {/* ── Expandable Micronutrients ── */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowMicronutrients((v) => !v);
                }}
                className="mt-3 flex-row items-center justify-center py-2 rounded-2xl"
                style={{ backgroundColor: c.cardAlt }}
                accessibilityRole="button"
                accessibilityLabel={t('dashboard.moreNutrients')}
              >
                <Text style={{ fontSize: 12, fontFamily: 'Inter-SemiBold', color: c.textTertiary }}>
                  {showMicronutrients ? t('dashboard.hideNutrients') : t('dashboard.moreNutrients')}
                </Text>
                <Ionicons
                  name={showMicronutrients ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={c.textTertiary}
                  style={{ marginLeft: 4 }}
                />
              </Pressable>

              {showMicronutrients ? (
                <Animated.View entering={FadeInDown.duration(250)} className="mt-3">
                  <View className="flex-row gap-3 mb-3">
                    <View
                      className="flex-1 rounded-2xl px-3 py-2.5"
                      style={{ backgroundColor: c.card }}
                    >
                      <Text style={{ fontSize: 16, fontFamily: 'Inter-Bold', color: c.text }}>
                        {consumed.fiber != null ? `${Math.round(consumed.fiber)}` : '–'}
                      </Text>
                      <Text
                        style={{ fontSize: 10, fontFamily: 'Inter-Medium', color: c.textTertiary }}
                      >
                        g
                      </Text>
                      <View className="flex-row items-center gap-1 mt-1.5">
                        <Text style={{ fontSize: 14 }}>🥦</Text>
                        <Text
                          style={{ fontSize: 11, fontFamily: 'Inter-SemiBold', color: c.success }}
                          numberOfLines={1}
                        >
                          {t('dashboard.fiber')}
                        </Text>
                      </View>
                    </View>
                    <View
                      className="flex-1 rounded-2xl px-3 py-2.5"
                      style={{ backgroundColor: c.card }}
                    >
                      <Text style={{ fontSize: 16, fontFamily: 'Inter-Bold', color: c.text }}>
                        {consumed.sugar != null ? `${Math.round(consumed.sugar)}` : '–'}
                      </Text>
                      <Text
                        style={{ fontSize: 10, fontFamily: 'Inter-Medium', color: c.textTertiary }}
                      >
                        g
                      </Text>
                      <View className="flex-row items-center gap-1 mt-1.5">
                        <Text style={{ fontSize: 14 }}>🍬</Text>
                        <Text
                          style={{ fontSize: 11, fontFamily: 'Inter-SemiBold', color: c.danger }}
                          numberOfLines={1}
                        >
                          {t('dashboard.sugar')}
                        </Text>
                      </View>
                    </View>
                    <View
                      className="flex-1 rounded-2xl px-3 py-2.5"
                      style={{ backgroundColor: c.card }}
                    >
                      <Text style={{ fontSize: 16, fontFamily: 'Inter-Bold', color: c.text }}>
                        {consumed.sodium != null ? `${Math.round(consumed.sodium)}` : '–'}
                      </Text>
                      <Text
                        style={{ fontSize: 10, fontFamily: 'Inter-Medium', color: c.textTertiary }}
                      >
                        mg
                      </Text>
                      <View className="flex-row items-center gap-1 mt-1.5">
                        <Text style={{ fontSize: 14 }}>🧂</Text>
                        <Text
                          style={{
                            fontSize: 11,
                            fontFamily: 'Inter-SemiBold',
                            color: c.primaryMuted,
                          }}
                          numberOfLines={1}
                        >
                          {t('dashboard.sodium')}
                        </Text>
                      </View>
                    </View>
                    <View
                      className="flex-1 rounded-2xl px-3 py-2.5"
                      style={{ backgroundColor: c.card }}
                    >
                      <Text style={{ fontSize: 16, fontFamily: 'Inter-Bold', color: c.text }}>
                        {consumed.saturatedFat != null
                          ? `${Math.round(consumed.saturatedFat)}`
                          : '–'}
                      </Text>
                      <Text
                        style={{ fontSize: 10, fontFamily: 'Inter-Medium', color: c.textTertiary }}
                      >
                        g
                      </Text>
                      <View className="flex-row items-center gap-1 mt-1.5">
                        <Text style={{ fontSize: 14 }}>🧈</Text>
                        <Text
                          style={{ fontSize: 11, fontFamily: 'Inter-SemiBold', color: c.warning }}
                          numberOfLines={1}
                        >
                          {t('dashboard.saturatedFat')}
                        </Text>
                      </View>
                    </View>
                  </View>
                </Animated.View>
              ) : null}
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
                      color={c.primary}
                      trackColor={c.trackBg}
                    >
                      <Text style={{ fontSize: 14 }}>💧</Text>
                    </ProgressArc>
                    <Text
                      testID="water-count"
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
                      testID="water-remove-btn"
                      onPress={() => removeCup(CUP_ML)}
                      disabled={effectiveWaterConsumed <= 0}
                      className="flex-1 h-8 rounded-xl items-center justify-center"
                      style={{ backgroundColor: c.cardAlt }}
                    >
                      <Ionicons
                        name="remove"
                        size={18}
                        color={effectiveWaterConsumed <= 0 ? c.muted : c.text}
                      />
                    </Pressable>
                    <Pressable
                      testID="water-add-btn"
                      onPress={() => addWater(CUP_ML)}
                      className="flex-1 h-8 rounded-xl bg-primary-500 items-center justify-center"
                    >
                      <Ionicons name="add" size={18} color={c.text} />
                    </Pressable>
                  </View>
                </View>
              </View>

              {/* Row 3: Fiber / Sugar / Sodium / Saturated Fat */}
              <View className="flex-row gap-3 mb-3">
                <NutrientMiniCard
                  label={t('dashboard.fiber')}
                  value={consumed.fiber != null ? `${Math.round(consumed.fiber)}` : '–'}
                  unit="g"
                  color={c.success}
                  icon="🥦"
                />
                <NutrientMiniCard
                  label={t('dashboard.sugar')}
                  value={consumed.sugar != null ? `${Math.round(consumed.sugar)}` : '–'}
                  unit="g"
                  color={c.danger}
                  icon="🍬"
                />
                <NutrientMiniCard
                  label={t('dashboard.sodium')}
                  value={consumed.sodium != null ? `${Math.round(consumed.sodium)}` : '–'}
                  unit="mg"
                  color={c.primaryMuted}
                  icon="🧂"
                />
              </View>
              <View className="flex-row gap-3">
                <NutrientMiniCard
                  label={t('dashboard.saturatedFat')}
                  value={
                    consumed.saturatedFat != null ? `${Math.round(consumed.saturatedFat)}` : '–'
                  }
                  unit="g"
                  color={c.warning}
                  icon="🧈"
                />
                <View className="flex-[2]" />
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
                        trackColor={c.trackBg}
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

            {/* Page 3 removed — streak info lives in header badge */}
          </ScrollView>

          {/* Carousel Dots */}
          <View className="flex-row items-center justify-center gap-1.5 mt-3 mb-1">
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: carouselPage === i ? c.text : c.border,
                }}
              />
            ))}
          </View>
        </Animated.View>

        {/* ── Recently Uploaded ── */}
        <Animated.View entering={FadeInDown.duration(350).delay(150)} className="px-4 mt-2">
          <Text
            testID="recently-added-header"
            style={{
              fontSize: 18,
              fontFamily: 'Inter-Bold',
              color: c.text,
              marginBottom: 12,
            }}
          >
            {t('dashboard.recentlyUploaded')}
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
            <>
              {/* Telegram CTA — shown when no meals logged today */}
              {telegramLinked === false ? (
                <Pressable
                  onPress={() =>
                    (navigation as { navigate: (s: string) => void }).navigate('TelegramConnect')
                  }
                  className="rounded-3xl p-5 mb-3"
                  style={{ backgroundColor: c.primary }}
                  accessibilityRole="button"
                  accessibilityLabel={t('dashboard.telegramCtaConnect')}
                >
                  <View className="flex-row items-center gap-3 mb-3">
                    <Ionicons name="paper-plane" size={28} color={c.onPrimary} />
                    <Text
                      style={{
                        fontSize: 16,
                        fontFamily: 'Inter-Bold',
                        color: c.onPrimary,
                        flex: 1,
                      }}
                    >
                      {t('dashboard.telegramCtaConnect')}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={c.onPrimary} />
                  </View>
                  <Text
                    style={{ fontSize: 13, fontFamily: 'Inter-Medium', color: `${c.onPrimary}cc` }}
                  >
                    {t('dashboard.telegramCtaConnectDesc')}
                  </Text>
                </Pressable>
              ) : telegramLinked === true ? (
                <View
                  className="rounded-3xl p-4 mb-3 flex-row items-center gap-3"
                  style={{ backgroundColor: c.card }}
                >
                  <Ionicons name="paper-plane-outline" size={22} color={c.primary} />
                  <Text
                    className="flex-1 text-sm font-sans-medium"
                    style={{ color: c.textSecondary }}
                  >
                    {t('dashboard.telegramCtaLinked')}
                  </Text>
                </View>
              ) : null}
              <Pressable
                onPress={handleLogMeal}
                className="rounded-3xl p-5"
                style={{ backgroundColor: c.card }}
              >
                <View
                  className="rounded-2xl p-4 mb-4 flex-row items-center gap-3"
                  style={{ backgroundColor: c.cardAlt }}
                >
                  <Text style={{ fontSize: 32 }}>🥗</Text>
                  <View className="flex-1">
                    <View
                      className="h-2.5 rounded-full mb-2"
                      style={{ backgroundColor: c.border, width: '80%' }}
                    />
                    <View
                      className="h-2.5 rounded-full"
                      style={{ backgroundColor: c.border, width: '55%' }}
                    />
                  </View>
                </View>
                <Text className="text-sm text-text-tertiary text-center font-sans-medium">
                  {t('dashboard.tapToAddFirst')}
                </Text>
              </Pressable>
            </>
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
