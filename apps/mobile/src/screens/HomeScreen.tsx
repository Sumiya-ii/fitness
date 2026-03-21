import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
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
import { api } from '../api';
import { useLocale } from '../i18n';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

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

// Animated progress arc that accepts children rendered in center
function ProgressArc({
  progress,
  size,
  strokeWidth,
  color,
  trackColor = '#e8eef5',
  children,
}: {
  progress: number;
  size: number;
  strokeWidth: number;
  color: string;
  trackColor?: string;
  children?: React.ReactNode;
}) {
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
          stroke={trackColor}
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
  unit: string;
  progress: number;
  color: string;
  icon: string;
}

function MacroCard({ label, leftAmount, unit, progress, color, icon }: MacroCardProps) {
  return (
    <View
      className="flex-1 bg-white rounded-3xl p-4"
      style={{
        shadowColor: '#0b1220',
        shadowOpacity: 0.06,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
      }}
    >
      <Text className="text-xl font-sans-bold text-[#0b1220] leading-tight">
        {leftAmount}
        {unit}
      </Text>
      <Text className="text-xs text-[#7687a2] font-sans-medium mb-3" numberOfLines={1}>
        {label} left
      </Text>
      <ProgressArc progress={progress} size={52} strokeWidth={5} color={color}>
        <Text style={{ fontSize: 18 }}>{icon}</Text>
      </ProgressArc>
    </View>
  );
}

interface MealSectionProps {
  type: string;
  meals: DashboardMeal[];
  typeLabel: string;
}

function MealSection({ type, meals, typeLabel }: MealSectionProps) {
  const totalCal = meals.reduce((s, m) => s + m.totalCalories, 0);
  const items = meals.flatMap((m) => m.items);

  return (
    <View
      className="bg-white rounded-3xl p-4 mb-3"
      style={{
        shadowColor: '#0b1220',
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
      }}
    >
      <View className="flex-row items-center mb-2">
        <Ionicons name={MEAL_TYPE_ICONS[type] ?? 'cafe-outline'} size={14} color="#9aabbf" />
        <Text className="ml-2 text-xs font-sans-semibold text-[#9aabbf] uppercase tracking-widest">
          {typeLabel}
        </Text>
      </View>
      {items.map((item, idx) => (
        <View
          key={item.id}
          className="flex-row items-center justify-between py-2.5"
          style={idx > 0 ? { borderTopWidth: 1, borderTopColor: '#f0f4f9' } : undefined}
        >
          <View className="flex-row items-center gap-3 flex-1 mr-3">
            <View className="h-9 w-9 rounded-xl bg-[#f4f7fb] items-center justify-center">
              <Text style={{ fontSize: 18 }}>🍽️</Text>
            </View>
            <Text className="text-sm font-sans-medium text-[#0b1220] flex-1" numberOfLines={1}>
              {item.snapshotFoodName}
            </Text>
          </View>
          <Text className="text-sm font-sans-bold text-[#0b1220]">
            {item.snapshotCalories} kcal
          </Text>
        </View>
      ))}
      {items.length > 1 && (
        <View
          className="flex-row justify-between pt-2 mt-1"
          style={{ borderTopWidth: 1, borderTopColor: '#f0f4f9' }}
        >
          <Text className="text-xs text-[#9aabbf]">Total</Text>
          <Text className="text-xs font-sans-semibold text-[#0b1220]">{totalCal} kcal</Text>
        </View>
      )}
    </View>
  );
}

export function HomeScreen() {
  const { t } = useLocale();
  const navigation = useNavigation();
  const { width: screenWidth } = useWindowDimensions();
  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  const [displayName, setDisplayName] = useState('');
  const { data, isLoading, fetchDashboard } = useDashboardStore();

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

  useEffect(() => {
    fetchDashboard(selectedDateKey);
  }, [fetchDashboard, selectedDateKey]);

  const onRefresh = useCallback(() => {
    loadProfile();
    fetchDashboard(selectedDateKey);
  }, [loadProfile, fetchDashboard, selectedDateKey]);

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

  return (
    <View className="flex-1 bg-[#f4f7fb]">
      <SafeAreaView edges={['top']}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 pt-3 pb-1">
          <View className="flex-row items-center gap-2.5">
            <View className="h-9 w-9 rounded-2xl bg-[#0f172a] items-center justify-center">
              <Ionicons name="nutrition" size={20} color="#ffffff" />
            </View>
            <Text className="text-2xl font-sans-bold text-[#0b1220]">
              {displayName ? displayName : 'Coach'}
            </Text>
          </View>
          <Pressable
            onPress={() =>
              (navigation as { navigate: (s: string) => void }).navigate('WeeklySummary')
            }
            className="flex-row items-center gap-1.5 bg-white rounded-full px-4 py-2"
            style={{
              shadowColor: '#0b1220',
              shadowOpacity: 0.06,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
              elevation: 2,
            }}
          >
            <Text style={{ fontSize: 15 }}>🔥</Text>
            <Text className="font-sans-bold text-[#0b1220] text-sm">{data?.mealCount ?? 0}</Text>
          </Pressable>
        </View>

        {/* Week Calendar Strip */}
        <View className="px-4 pb-2 pt-1">
          <Text
            style={{
              fontSize: 11,
              fontFamily: 'Inter-SemiBold',
              color: '#9aabbf',
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
              const circleSize = Math.min(cellSize - 8, 40);

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
                      color: isSelected || isToday ? '#0b1220' : isPast ? '#b0bec5' : '#d1dae6',
                      marginBottom: 6,
                      letterSpacing: 0.3,
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
                      ...(isSelected
                        ? { backgroundColor: '#0f172a' }
                        : isToday
                          ? {
                              backgroundColor: '#ffffff',
                              borderWidth: 2,
                              borderColor: '#0f172a',
                              shadowColor: '#0f172a',
                              shadowOpacity: 0.15,
                              shadowRadius: 6,
                              shadowOffset: { width: 0, height: 2 },
                            }
                          : isPast
                            ? { backgroundColor: '#f0f4f9' }
                            : {}),
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontFamily: isSelected || isToday ? 'Inter-Bold' : 'Inter-Medium',
                        color: isSelected
                          ? '#ffffff'
                          : isToday
                            ? '#0f172a'
                            : isPast
                              ? '#7687a2'
                              : '#c3cedf',
                      }}
                    >
                      {date.getDate()}
                    </Text>
                  </View>
                  {/* Progress dot */}
                  <View
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: 2,
                      marginTop: 5,
                      backgroundColor:
                        isToday && (data?.consumed?.calories ?? 0) > 0
                          ? '#22c55e'
                          : isSelected && !isToday
                            ? '#0f172a'
                            : 'transparent',
                    }}
                  />
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
            tintColor="#0f172a"
          />
        }
      >
        {/* Calorie Card */}
        <Animated.View entering={FadeInDown.duration(350)} className="mx-4 mb-3">
          <Pressable
            onPress={handleLogMeal}
            className="bg-white rounded-3xl p-5"
            style={{
              shadowColor: '#0b1220',
              shadowOpacity: 0.07,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 4 },
              elevation: 3,
            }}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-6xl font-sans-bold text-[#0b1220] leading-none">
                  {remaining}
                </Text>
                <Text className="text-base text-[#7687a2] font-sans-medium mt-2">
                  {t('dashboard.caloriesLeft')}
                </Text>
                <View className="flex-row items-center gap-4 mt-3">
                  <View className="flex-row items-center gap-1.5">
                    <View className="h-2 w-2 rounded-full bg-[#f97316]" />
                    <Text className="text-xs text-[#9aabbf] font-sans-medium">
                      {consumed.calories} {t('dashboard.eaten')}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <View className="h-2 w-2 rounded-full bg-[#dde5f0]" />
                    <Text className="text-xs text-[#9aabbf] font-sans-medium">
                      {targets.calories} goal
                    </Text>
                  </View>
                </View>
              </View>
              <ProgressArc progress={calProg} size={90} strokeWidth={8} color="#0f172a">
                <Text style={{ fontSize: 30 }}>🔥</Text>
              </ProgressArc>
            </View>
          </Pressable>
        </Animated.View>

        {/* Macro Cards */}
        <Animated.View
          entering={FadeInDown.delay(80).duration(350)}
          className="flex-row mx-4 gap-3 mb-5"
        >
          <MacroCard
            label={t('dashboard.protein')}
            leftAmount={proteinLeft}
            unit="g"
            progress={proteinProg}
            color="#f97316"
            icon="🍗"
          />
          <MacroCard
            label={t('dashboard.carbs')}
            leftAmount={carbsLeft}
            unit="g"
            progress={carbsProg}
            color="#f59e0b"
            icon="🌾"
          />
          <MacroCard
            label={t('dashboard.fat')}
            leftAmount={fatLeft}
            unit="g"
            progress={fatProg}
            color="#3b82f6"
            icon="🫐"
          />
        </Animated.View>

        {/* Recently Logged */}
        <View className="px-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-xl font-sans-bold text-[#0b1220]">
              {isTodaySelected ? t('dashboard.todaysMeals') : t('dashboard.meals')}
            </Text>
            <Pressable
              onPress={handleLogMeal}
              className="h-8 w-8 rounded-full bg-[#0f172a] items-center justify-center"
            >
              <Ionicons name="add" size={18} color="#ffffff" />
            </Pressable>
          </View>

          {!hasMeals ? (
            <Animated.View entering={FadeInDown.delay(160).duration(350)}>
              <Pressable
                onPress={handleLogMeal}
                className="bg-white rounded-3xl overflow-hidden"
                style={{
                  shadowColor: '#0b1220',
                  shadowOpacity: 0.04,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 2,
                }}
              >
                {/* Placeholder meal row (decorative, like Cal AI) */}
                <View className="px-5 pt-5 pb-2">
                  <View className="flex-row items-center gap-3 bg-[#f4f7fb] rounded-2xl p-4 mb-2">
                    <Text style={{ fontSize: 28 }}>🥗</Text>
                    <View className="flex-1 gap-2">
                      <View className="h-3 rounded-full bg-[#dde5f0] w-3/4" />
                      <View className="h-2.5 rounded-full bg-[#e8eef5] w-1/2" />
                    </View>
                  </View>
                </View>
                <View className="px-5 pb-5">
                  <Text className="text-sm text-[#9aabbf] text-center font-sans-medium">
                    {isTodaySelected
                      ? 'Tap + to add your first meal of the day'
                      : t('dashboard.noMeals')}
                  </Text>
                </View>
              </Pressable>
            </Animated.View>
          ) : (
            mealOrder.map((type, index) => {
              const meals = mealsByType[type];
              if (!meals || meals.length === 0) return null;
              return (
                <Animated.View
                  key={type}
                  entering={FadeInDown.delay(100 + 60 * index).duration(350)}
                >
                  <MealSection
                    type={type}
                    meals={meals}
                    typeLabel={t(MEAL_TYPE_LABELS[type] ?? type)}
                  />
                </Animated.View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function HomeSkeleton() {
  return (
    <View className="flex-1 bg-[#f4f7fb]">
      <SafeAreaView edges={['top']}>
        <View className="flex-row items-center justify-between px-5 pt-3 pb-3">
          <SkeletonLoader width={130} height={36} borderRadius={12} />
          <SkeletonLoader width={60} height={34} borderRadius={20} />
        </View>
        <View className="px-3 py-2">
          <SkeletonLoader height={62} borderRadius={16} />
        </View>
      </SafeAreaView>
      <View className="px-4 pt-2 gap-3">
        <SkeletonLoader height={140} borderRadius={24} />
        <View className="flex-row gap-3">
          <View className="flex-1">
            <SkeletonLoader height={130} borderRadius={24} />
          </View>
          <View className="flex-1">
            <SkeletonLoader height={130} borderRadius={24} />
          </View>
          <View className="flex-1">
            <SkeletonLoader height={130} borderRadius={24} />
          </View>
        </View>
        <SkeletonLoader height={140} borderRadius={24} />
      </View>
    </View>
  );
}
