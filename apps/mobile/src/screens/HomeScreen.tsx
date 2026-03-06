import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
import { useDashboardStore, type DashboardMeal } from '../stores/dashboard.store';
import { api } from '../api';
import { useLocale } from '../i18n';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  breakfast: '#f59e0b',
  lunch: '#22c55e',
  dinner: '#6366f1',
  snack: '#ec4899',
};

export function HomeScreen() {
  const { t } = useLocale();
  const navigation = useNavigation();
  const [displayName, setDisplayName] = useState<string>('there');
  const { data, isLoading, fetchDashboard } = useDashboardStore();

  const loadProfile = useCallback(async () => {
    try {
      const res = await api.get<{ data: { displayName: string | null } }>('/profile');
      setDisplayName(res.data.displayName || 'there');
    } catch {
      setDisplayName('there');
    }
  }, []);

  const onRefresh = useCallback(() => {
    loadProfile();
    fetchDashboard();
  }, [fetchDashboard, loadProfile]);

  useEffect(() => {
    onRefresh();
  }, [onRefresh]);

  const handleLogMeal = () => {
    (navigation as { navigate: (s: string) => void }).navigate('Log');
  };

  const handleQuickAdd = () => {
    (navigation as { navigate: (s: string) => void }).navigate('Log');
  };

  const handleWeeklySummary = () => {
    (navigation as { navigate: (s: string) => void }).navigate('WeeklySummary');
  };

  if (isLoading && !data) {
    return <LoadingScreen />;
  }

  const targets = data?.targets ?? { calories: 2000, protein: 150, carbs: 200, fat: 65 };
  const consumed = data?.consumed ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const remaining = Math.max(targets.calories - consumed.calories, 0);
  const calorieProgress = targets.calories > 0
    ? Math.min(consumed.calories / targets.calories, 1)
    : 0;

  const mealsByType = (data?.meals ?? []).reduce<Record<string, DashboardMeal[]>>(
    (acc, m) => {
      const type = m.mealType || 'snack';
      if (!acc[type]) acc[type] = [];
      acc[type].push(m);
      return acc;
    },
    {}
  );

  const mealOrder = ['breakfast', 'lunch', 'dinner', 'snack'];

  return (
    <View className="flex-1 bg-slate-950">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading && !!data}
            onRefresh={onRefresh}
            tintColor="#22c55e"
          />
        }
      >
        {/* Hero Section with Gradient */}
        <LinearGradient
          colors={['#0f172a', '#1e293b', '#0f172a']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <SafeAreaView edges={['top']}>
            {/* Header */}
            <View className="px-5 pt-2 pb-1">
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-base text-slate-400 font-sans-medium">
                    {new Date().getHours() < 12
                      ? t('dashboard.greeting')
                      : new Date().getHours() < 18
                        ? t('dashboard.greetingAfternoon')
                        : t('dashboard.greetingEvening')}
                  </Text>
                  <Text className="text-2xl font-sans-bold text-white mt-0.5">
                    {displayName}
                  </Text>
                </View>
                <Pressable
                  onPress={handleWeeklySummary}
                  className="h-10 w-10 items-center justify-center rounded-full bg-white/10"
                >
                  <Ionicons name="stats-chart" size={20} color="#22c55e" />
                </Pressable>
              </View>
            </View>

            {/* Calorie Ring */}
            <View className="items-center pt-4 pb-2">
              <ProgressRing
                progress={calorieProgress}
                size={SCREEN_WIDTH * 0.52}
                color="#22c55e"
                gradientEnd="#4ade80"
                backgroundColor="#334155"
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
                color="#3b82f6"
              />
              <CircularMacro
                label={t('dashboard.carbs')}
                current={consumed.carbs}
                target={targets.carbs}
                color="#f59e0b"
              />
              <CircularMacro
                label={t('dashboard.fat')}
                current={consumed.fat}
                target={targets.fat}
                color="#ec4899"
              />
            </Animated.View>
          </SafeAreaView>
        </LinearGradient>

        {/* Quick Actions */}
        <View className="px-4 -mt-3">
          <View className="flex-row gap-2">
            <Pressable
              onPress={handleLogMeal}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-primary-500 px-4 py-3.5 shadow-lg shadow-primary-500/30"
            >
              <Ionicons name="add-circle" size={20} color="#ffffff" />
              <Text className="font-sans-semibold text-white">Log Meal</Text>
            </Pressable>
            <Pressable
              onPress={handleQuickAdd}
              className="flex-row items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-3.5 border border-white/10"
            >
              <Ionicons name="flash" size={18} color="#f59e0b" />
              <Text className="font-sans-medium text-white">Quick</Text>
            </Pressable>
            <Pressable
              onPress={() => (navigation as { navigate: (s: string) => void }).navigate('Log')}
              className="flex-row items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-3.5 border border-white/10"
            >
              <Ionicons name="barcode-outline" size={18} color="#a78bfa" />
              <Text className="font-sans-medium text-white">Scan</Text>
            </Pressable>
          </View>
        </View>

        {/* Today's Meals */}
        <View className="px-4 pt-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-sans-semibold text-white">
              {t('dashboard.todaysMeals')}
            </Text>
            <Text className="text-sm text-slate-400 font-sans-medium">
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
            <View className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 items-center">
              <View className="h-16 w-16 rounded-full bg-slate-800 items-center justify-center mb-4">
                <Ionicons name="nutrition-outline" size={32} color="#475569" />
              </View>
              <Text className="text-base font-sans-semibold text-white mb-1">
                No meals logged yet
              </Text>
              <Text className="text-sm text-slate-400 text-center mb-4">
                Log your first meal to track your daily nutrition
              </Text>
              <Pressable
                onPress={handleLogMeal}
                className="rounded-full bg-primary-500 px-6 py-2.5"
              >
                <Text className="font-sans-semibold text-white text-sm">
                  Log Meal
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Calorie Budget by Meal (CalAI-style targets) */}
        <View className="px-4 pt-6">
          <Text className="text-lg font-sans-semibold text-white mb-3">
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
                  className="flex-1 rounded-2xl bg-slate-900/80 border border-slate-800 p-3 items-center"
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
                  <Text className="text-xs text-slate-400 font-sans-medium mb-1">
                    {MEAL_TYPE_LABELS[type]}
                  </Text>
                  <Text className="text-sm font-sans-bold text-white">
                    {mealCals}
                  </Text>
                  <View className="w-full h-1 rounded-full bg-slate-700 mt-2 overflow-hidden">
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

  const color = MEAL_TYPE_COLORS[type] ?? '#22c55e';

  return (
    <Pressable
      onPress={handlePress}
      className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 mb-3"
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
          <Text className="font-sans-semibold text-white text-base">
            {MEAL_TYPE_LABELS[type] ?? type}
          </Text>
          <Text
            className="text-sm text-slate-400 mt-0.5"
            numberOfLines={expanded ? undefined : 1}
          >
            {foodNames.join(', ') || 'Quick add'}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-base font-sans-bold text-white">
            {totalCal}
          </Text>
          <Text className="text-xs text-slate-400">kcal</Text>
        </View>
        <Animated.View style={chevronStyle} className="ml-2">
          <Ionicons name="chevron-down" size={18} color="#64748b" />
        </Animated.View>
      </View>

      {expanded && (
        <View className="mt-3 pt-3 border-t border-slate-800">
          {meals.flatMap((m) =>
            m.items.map((item) => (
              <View key={item.id} className="flex-row items-center justify-between py-2">
                <View className="flex-row items-center flex-1 mr-4">
                  <View className="h-2 w-2 rounded-full mr-3" style={{ backgroundColor: color }} />
                  <Text className="text-sm text-slate-200 flex-1" numberOfLines={1}>
                    {item.snapshotFoodName}
                  </Text>
                </View>
                <Text className="text-sm font-sans-medium text-white">
                  {item.snapshotCalories} kcal
                </Text>
              </View>
            ))
          )}
          <View className="flex-row items-center justify-between pt-2 mt-1 border-t border-slate-800/50">
            <Text className="text-xs text-slate-500">Total protein</Text>
            <Text className="text-sm font-sans-medium text-blue-400">
              {totalProtein}g
            </Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}
