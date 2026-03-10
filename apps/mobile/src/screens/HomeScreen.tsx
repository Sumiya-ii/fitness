import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeInDown,
} from 'react-native-reanimated';
import {
  ProgressRing,
  CircularMacro,
  LoadingScreen,
} from '../components/ui';
import {
  useDashboardStore,
  type DashboardData,
  type DashboardMeal,
} from '../stores/dashboard.store';
import { api } from '../api';
import { useLocale } from '../i18n';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const WEEK_PAGE_COUNT = 53;
const INITIAL_WEEK_PAGE = Math.floor(WEEK_PAGE_COUNT / 2);

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

const MEAL_TYPE_ICONS: Record<string, string> = {
  breakfast: 'sunny-outline',
  lunch: 'restaurant-outline',
  dinner: 'moon-outline',
  snack: 'cafe-outline',
};

const MEAL_TYPE_COLORS: Record<string, string> = {
  breakfast: '#ea580c',
  lunch: '#0f172a',
  dinner: '#0e7490',
  snack: '#64748b',
};

interface DayProgressSummary {
  consumedCalories: number;
  targetCalories: number;
  mealCount: number;
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fromDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function startOfWeek(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - copy.getDay());
  return copy;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function HomeScreen() {
  const { t } = useLocale();
  const navigation = useNavigation();
  const [displayName, setDisplayName] = useState<string>('there');
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()));
  const [activeWeekPage, setActiveWeekPage] = useState(INITIAL_WEEK_PAGE);
  const [weekProgressByDate, setWeekProgressByDate] = useState<Record<string, DayProgressSummary>>({});
  const weekProgressRef = useRef<Record<string, DayProgressSummary>>({});
  const { data, isLoading, fetchDashboard } = useDashboardStore();

  useEffect(() => {
    weekProgressRef.current = weekProgressByDate;
  }, [weekProgressByDate]);

  const weekPages = useMemo(() => Array.from({ length: WEEK_PAGE_COUNT }, (_, index) => index), []);
  const selectedDate = useMemo(() => fromDateKey(selectedDateKey), [selectedDateKey]);
  const selectedWeekday = selectedDate.getDay();
  const activeWeekStart = useMemo(() => {
    const todayWeekStart = startOfWeek(new Date());
    return addDays(todayWeekStart, (activeWeekPage - INITIAL_WEEK_PAGE) * 7);
  }, [activeWeekPage]);

  const loadProfile = useCallback(async () => {
    try {
      const res = await api.get<{ data: { displayName: string | null } }>('/profile');
      setDisplayName(res.data.displayName || 'there');
    } catch {
      setDisplayName('there');
    }
  }, []);

  const prefetchWeek = useCallback(async (weekStartDate: Date) => {
    const missingDateKeys: string[] = [];
    for (let i = 0; i < 7; i += 1) {
      const dateKey = toDateKey(addDays(weekStartDate, i));
      if (!weekProgressRef.current[dateKey]) {
        missingDateKeys.push(dateKey);
      }
    }
    if (missingDateKeys.length === 0) return;

    const responses = await Promise.all(
      missingDateKeys.map(async (dateKey) => {
        const response = await api.get<{ data: DashboardData }>(`/dashboard?date=${dateKey}`);
        const dashboard = response.data;
        return {
          dateKey,
          consumedCalories: dashboard.consumed.calories,
          targetCalories: dashboard.targets?.calories ?? 0,
          mealCount: dashboard.mealCount,
        };
      })
    );

    setWeekProgressByDate((current) => {
      const next = { ...current };
      for (const entry of responses) {
        next[entry.dateKey] = {
          consumedCalories: entry.consumedCalories,
          targetCalories: entry.targetCalories,
          mealCount: entry.mealCount,
        };
      }
      return next;
    });
  }, []);

  const onRefresh = useCallback(() => {
    loadProfile();
    fetchDashboard(selectedDateKey);
    prefetchWeek(activeWeekStart).catch(() => undefined);
  }, [activeWeekStart, fetchDashboard, loadProfile, prefetchWeek, selectedDateKey]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    fetchDashboard(selectedDateKey);
  }, [fetchDashboard, selectedDateKey]);

  useEffect(() => {
    prefetchWeek(activeWeekStart).catch(() => undefined);
  }, [activeWeekStart, prefetchWeek]);

  useEffect(() => {
    if (!data) return;
    setWeekProgressByDate((current) => ({
      ...current,
      [data.date]: {
        consumedCalories: data.consumed.calories,
        targetCalories: data.targets?.calories ?? 0,
        mealCount: data.mealCount,
      },
    }));
  }, [data]);

  const handleLogMeal = () => {
    (navigation as { navigate: (s: string) => void }).navigate('Log');
  };

  const handleQuickAdd = () => {
    (navigation as { navigate: (s: string) => void }).navigate('Log');
  };

  const handleWeeklySummary = () => {
    (navigation as { navigate: (s: string) => void }).navigate('WeeklySummary');
  };

  const handleDaySelect = (dateKey: string) => {
    setSelectedDateKey(dateKey);
  };

  const handleWeekMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const pageIndex = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (pageIndex === activeWeekPage) return;

    setActiveWeekPage(pageIndex);
    const todayWeekStart = startOfWeek(new Date());
    const weekStart = addDays(todayWeekStart, (pageIndex - INITIAL_WEEK_PAGE) * 7);
    const nextSelectedDate = toDateKey(addDays(weekStart, selectedWeekday));
    setSelectedDateKey(nextSelectedDate);
  };

  const renderWeekPage = (item: number) => {
    const todayWeekStart = startOfWeek(new Date());
    const weekStart = addDays(todayWeekStart, (item - INITIAL_WEEK_PAGE) * 7);
    const todayKey = toDateKey(new Date());
    const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
      <View key={`week-${item}`} style={{ width: SCREEN_WIDTH }} className="px-4 pb-5 pt-2">
        <View className="flex-row justify-between">
          {weekdayLabels.map((weekday, dayIndex) => {
            const date = addDays(weekStart, dayIndex);
            const dateKey = toDateKey(date);
            const isSelected = selectedDateKey === dateKey;
            const isToday = todayKey === dateKey;
            const summary = weekProgressByDate[dateKey];
            return (
              <Pressable
                key={dateKey}
                onPress={() => handleDaySelect(dateKey)}
                className={`w-11 items-center rounded-2xl py-2 ${isSelected ? 'bg-white/80' : ''}`}
              >
                <Text
                  className={`mb-1 text-xs font-sans-medium ${isSelected ? 'text-text' : 'text-text-secondary'}`}
                >
                  {weekday}
                </Text>
                <DayProgressCircle
                  dayNumber={date.getDate()}
                  consumedCalories={summary?.consumedCalories ?? 0}
                  targetCalories={summary?.targetCalories ?? 0}
                  hasMeals={(summary?.mealCount ?? 0) > 0}
                  isSelected={isSelected}
                  isToday={isToday}
                />
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  if (isLoading && !data) {
    return <LoadingScreen />;
  }

  const selectedDashboardData = data;
  const targets = selectedDashboardData?.targets ?? {
    calories: 2000,
    protein: 150,
    carbs: 200,
    fat: 65,
  };
  const consumed = selectedDashboardData?.consumed ?? {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  };
  const remaining = Math.max(targets.calories - consumed.calories, 0);
  const calorieProgress = targets.calories > 0
    ? Math.min(consumed.calories / targets.calories, 1)
    : 0;

  const mealsByType = (selectedDashboardData?.meals ?? []).reduce<Record<string, DashboardMeal[]>>(
    (acc, m) => {
      const type = m.mealType || 'snack';
      if (!acc[type]) acc[type] = [];
      acc[type].push(m);
      return acc;
    },
    {}
  );

  const mealOrder = ['breakfast', 'lunch', 'dinner', 'snack'];
  const isTodaySelected = selectedDateKey === toDateKey(new Date());
  const mealsHeading = isTodaySelected ? t('dashboard.todaysMeals') : `Meals • ${selectedDateKey}`;

  return (
    <View className="flex-1 bg-surface-app">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading && !!data}
            onRefresh={onRefresh}
            tintColor="#0f172a"
          />
        }
      >
        {/* Hero Section with Gradient */}
        <LinearGradient
          colors={['#e7eef8', '#dce6f5', '#e7eef8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <SafeAreaView edges={['top']}>
            {/* Header */}
            <View className="px-5 pt-2 pb-1">
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-base text-text-secondary font-sans-medium">
                    {new Date().getHours() < 12
                      ? t('dashboard.greeting')
                      : new Date().getHours() < 18
                        ? t('dashboard.greetingAfternoon')
                        : t('dashboard.greetingEvening')}
                  </Text>
                  <Text className="text-2xl font-sans-bold text-text mt-0.5">
                    {displayName}
                  </Text>
                </View>
                <Pressable
                  onPress={handleWeeklySummary}
                  className="h-10 w-10 items-center justify-center rounded-full bg-white/80 border border-surface-border"
                >
                  <Ionicons name="stats-chart" size={20} color="#0f172a" />
                </Pressable>
              </View>
            </View>

            {/* Weekly Progress Calendar */}
            <ScrollView
              horizontal
              pagingEnabled
              contentOffset={{ x: SCREEN_WIDTH * INITIAL_WEEK_PAGE, y: 0 }}
              onMomentumScrollEnd={handleWeekMomentumEnd}
              showsHorizontalScrollIndicator={false}
            >
              {weekPages.map(renderWeekPage)}
            </ScrollView>

            {/* Calorie Ring */}
            <View className="items-center pt-4 pb-2">
              <ProgressRing
                progress={calorieProgress}
                size={SCREEN_WIDTH * 0.52}
                color="#0f172a"
                gradientEnd="#1e293b"
                backgroundColor="#c3cedf"
                strokeWidth={14}
                centerLabel={`${remaining}`}
                centerSubLabel="remaining"
                centerCaption={`${consumed.calories} eaten`}
              />
            </View>

            {/* Macro Circles Row */}
            <Animated.View
              entering={FadeInDown.delay(200).duration(400)}
              className="flex-row justify-evenly px-4 pt-4 pb-6"
            >
              <CircularMacro
                label={t('dashboard.protein')}
                current={consumed.protein}
                target={targets.protein}
                color="#0e7490"
              />
              <CircularMacro
                label={t('dashboard.carbs')}
                current={consumed.carbs}
                target={targets.carbs}
                color="#ea580c"
              />
              <CircularMacro
                label={t('dashboard.fat')}
                current={consumed.fat}
                target={targets.fat}
                color="#64748b"
              />
            </Animated.View>
          </SafeAreaView>
        </LinearGradient>

        {/* Quick Actions */}
        <View className="px-4 -mt-3">
          <View className="flex-row gap-2">
            <Pressable
              onPress={handleLogMeal}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-primary-500 px-4 py-3.5 shadow-lg shadow-primary-500/25"
            >
              <Ionicons name="add-circle" size={20} color="#ffffff" />
              <Text className="font-sans-semibold text-text-inverse">Log Meal</Text>
            </Pressable>
            <Pressable
              onPress={handleQuickAdd}
              className="flex-row items-center justify-center gap-2 rounded-2xl bg-surface-default px-4 py-3.5 border border-surface-border"
            >
              <Ionicons name="flash" size={18} color="#ea580c" />
              <Text className="font-sans-medium text-text">Quick</Text>
            </Pressable>
            <Pressable
              onPress={() => (navigation as { navigate: (s: string) => void }).navigate('Log')}
              className="flex-row items-center justify-center gap-2 rounded-2xl bg-surface-default px-4 py-3.5 border border-surface-border"
            >
              <Ionicons name="barcode-outline" size={18} color="#0e7490" />
              <Text className="font-sans-medium text-text">Scan</Text>
            </Pressable>
          </View>
        </View>

        {/* Today's Meals */}
        <View className="px-4 pt-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-sans-semibold text-text">
              {mealsHeading}
            </Text>
            <Text className="text-sm text-text-secondary font-sans-medium">
              {consumed.calories} kcal total
            </Text>
          </View>

          {mealOrder.some((t) => mealsByType[t]?.length) ? (
            mealOrder.map((type, index) => {
              const meals = mealsByType[type] ?? [];
              if (meals.length === 0) return null;
              return (
                <Animated.View
                  key={type}
                  entering={FadeInDown.delay(100 * index).duration(400)}
                >
                  <MealCard type={type} meals={meals} />
                </Animated.View>
              );
            })
          ) : (
            <View className="rounded-2xl bg-surface-card border border-surface-border p-6 items-center">
              <View className="h-16 w-16 rounded-full bg-surface-secondary items-center justify-center mb-4">
                <Ionicons name="nutrition-outline" size={32} color="#777985" />
              </View>
              <Text className="text-base font-sans-semibold text-text mb-1">
                No meals logged yet
              </Text>
              <Text className="text-sm text-text-secondary text-center mb-4">
                Log your first meal to track your daily nutrition
              </Text>
              <Pressable
                onPress={handleLogMeal}
                className="rounded-full bg-primary-500 px-6 py-2.5"
              >
                <Text className="font-sans-semibold text-text-inverse text-sm">
                  Log Meal
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Calorie Budget by Meal (CalAI-style targets) */}
        <View className="px-4 pt-6">
          <Text className="text-lg font-sans-semibold text-text mb-3">
            {t('dashboard.caloriesBudget')}
          </Text>
          <View className="flex-row gap-2">
            {mealOrder.map((type) => {
              const meals = mealsByType[type] ?? [];
              const mealCals = meals.reduce((s, m) => s + m.totalCalories, 0);
              const budgetPerMeal = Math.round(targets.calories * (type === 'snack' ? 0.1 : 0.3));
              const used = budgetPerMeal > 0 ? Math.min(mealCals / budgetPerMeal, 1) : 0;
              return (
                <View
                  key={type}
                  className="flex-1 rounded-2xl bg-surface-card border border-surface-border p-3 items-center"
                >
                  <View
                    className="h-9 w-9 rounded-full items-center justify-center mb-2"
                    style={{ backgroundColor: `${MEAL_TYPE_COLORS[type]}20` }}
                  >
                    <Ionicons
                      name={MEAL_TYPE_ICONS[type] as keyof typeof Ionicons.glyphMap}
                      size={18}
                      color={MEAL_TYPE_COLORS[type]}
                    />
                  </View>
                  <Text className="text-xs text-text-secondary font-sans-medium mb-1">
                    {MEAL_TYPE_LABELS[type]}
                  </Text>
                  <Text className="text-sm font-sans-bold text-text">
                    {mealCals}
                  </Text>
                  <View className="w-full h-1 rounded-full bg-surface-muted mt-2 overflow-hidden">
                    <View
                      className="h-full rounded-full"
                      style={{
                        width: `${used * 100}%`,
                        backgroundColor: MEAL_TYPE_COLORS[type],
                      }}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

interface DayProgressCircleProps {
  dayNumber: number;
  consumedCalories: number;
  targetCalories: number;
  hasMeals: boolean;
  isSelected: boolean;
  isToday: boolean;
}

function DayProgressCircle({
  dayNumber,
  consumedCalories,
  targetCalories,
  hasMeals,
  isSelected,
  isToday,
}: DayProgressCircleProps) {
  const size = 42;
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = targetCalories > 0 ? Math.min(consumedCalories / targetCalories, 1) : 0;
  const strokeDashoffset = circumference * (1 - progress);

  const trackColor = isSelected ? '#b9bbc8' : '#cbccd8';
  const progressColor = isSelected ? '#1f2028' : '#8f93a4';
  const textColor = isSelected ? '#1f2028' : isToday ? '#2a2b35' : '#777985';

  return (
    <View className="items-center justify-center">
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={hasMeals ? undefined : '5 4'}
          opacity={0.8}
        />
        {hasMeals ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={progressColor}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        ) : null}
      </Svg>
      <Text
        style={{ position: 'absolute', color: textColor }}
        className="font-sans-semibold text-base"
      >
        {dayNumber}
      </Text>
    </View>
  );
}

interface MealCardProps {
  type: string;
  meals: DashboardMeal[];
}

function MealCard({ type, meals }: MealCardProps) {
  const [expanded, setExpanded] = useState(false);
  const totalCal = meals.reduce((s, m) => s + m.totalCalories, 0);
  const totalProtein = meals.reduce((s, m) => s + m.totalProtein, 0);
  const foodNames = meals
    .flatMap((m) => m.items.map((i) => i.snapshotFoodName))
    .filter(Boolean);

  const iconScale = useSharedValue(1);
  const chevronRotation = useSharedValue(0);

  useEffect(() => {
    chevronRotation.value = withSpring(expanded ? 180 : 0, {
      damping: 15,
      stiffness: 200,
    });
  }, [expanded, chevronRotation]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value}deg` }],
  }));

  const handlePress = () => {
    iconScale.value = withSpring(1.1, {}, () => {
      iconScale.value = withSpring(1);
    });
    setExpanded((e) => !e);
  };

  const color = MEAL_TYPE_COLORS[type] ?? '#1f2028';

  return (
    <Pressable
      onPress={handlePress}
      className="rounded-2xl bg-surface-card border border-surface-border p-4 mb-3"
    >
      <View className="flex-row items-center">
        <View
          className="h-10 w-10 rounded-full items-center justify-center mr-3"
          style={{ backgroundColor: `${color}20` }}
        >
          <Ionicons
            name={MEAL_TYPE_ICONS[type] as keyof typeof Ionicons.glyphMap}
            size={20}
            color={color}
          />
        </View>
        <View className="flex-1">
          <Text className="font-sans-semibold text-text text-base">
            {MEAL_TYPE_LABELS[type] ?? type}
          </Text>
          <Text
            className="text-sm text-text-secondary mt-0.5"
            numberOfLines={expanded ? undefined : 1}
          >
            {foodNames.join(', ') || 'Quick add'}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-base font-sans-bold text-text">
            {totalCal}
          </Text>
          <Text className="text-xs text-text-secondary">kcal</Text>
        </View>
        <Animated.View style={chevronStyle} className="ml-2">
                  <Ionicons name="chevron-down" size={18} color="#7687a2" />
        </Animated.View>
      </View>

      {expanded && (
        <View className="mt-3 pt-3 border-t border-surface-border">
          {meals.flatMap((m) =>
            m.items.map((item) => (
              <View key={item.id} className="flex-row items-center justify-between py-2">
                <View className="flex-row items-center flex-1 mr-4">
                  <View className="h-2 w-2 rounded-full mr-3" style={{ backgroundColor: color }} />
                  <Text className="text-sm text-text-secondary flex-1" numberOfLines={1}>
                    {item.snapshotFoodName}
                  </Text>
                </View>
                <Text className="text-sm font-sans-medium text-text">
                  {item.snapshotCalories} kcal
                </Text>
              </View>
            ))
          )}
          <View className="flex-row items-center justify-between pt-2 mt-1 border-t border-surface-border/50">
            <Text className="text-xs text-text-tertiary">Total protein</Text>
                <Text className="text-sm font-sans-medium text-accent-700">
                  {totalProtein}g
                </Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}
