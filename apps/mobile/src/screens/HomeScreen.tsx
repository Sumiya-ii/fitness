import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  ProgressRing,
  MacroBar,
  Card,
  Button,
  EmptyState,
  LoadingScreen,
} from '../components/ui';
import { useDashboardStore, type DashboardMeal } from '../stores/dashboard.store';
import { api } from '../api';

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function HomeScreen() {
  const navigation = useNavigation();
  const [displayName, setDisplayName] = useState<string>('there');
  const { data, isLoading, error, fetchDashboard } = useDashboardStore();

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

  const handleScan = () => {
    (navigation as { navigate: (s: string) => void }).navigate('Search');
  };

  if (isLoading && !data) {
    return <LoadingScreen />;
  }

  const targets = data?.targets ?? { calories: 2000, protein: 150, carbs: 200, fat: 65 };
  const consumed = data?.consumed ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const calorieProgress = targets.calories > 0
    ? Math.min(consumed.calories / targets.calories, 1)
    : 0;
  const centerLabel = targets.calories > 0
    ? `${consumed.calories} / ${targets.calories}`
    : '0';

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
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading && !!data}
            onRefresh={onRefresh}
            tintColor="#22c55e"
          />
        }
      >
        <View className="px-4 pt-4 pb-2">
          <Text className="text-2xl font-sans-bold text-text dark:text-slate-100">
            {getGreeting()}, {displayName}
          </Text>
          <Text className="mt-1 text-base text-text-secondary dark:text-slate-400">
            {data?.date ? formatDisplayDate(data.date) : formatDisplayDate(new Date().toISOString().split('T')[0])}
          </Text>
        </View>

        <View className="items-center py-6">
          <ProgressRing
            progress={calorieProgress}
            size={160}
            color="#22c55e"
            centerLabel={centerLabel}
            label="kcal"
          />
        </View>

        <View className="px-4 gap-4">
          <View className="gap-1">
            <MacroBar
              label="Protein"
              current={consumed.protein}
              target={targets.protein}
              color="#3b82f6"
              size="large"
            />
            <View className="h-2" />
            <MacroBar
              label="Carbs"
              current={consumed.carbs}
              target={targets.carbs}
              color="#f59e0b"
            />
            <MacroBar
              label="Fat"
              current={consumed.fat}
              target={targets.fat}
              color="#ec4899"
            />
          </View>

          <View className="flex-row flex-wrap gap-2 pt-2">
            <Pressable
              onPress={handleLogMeal}
              className="flex-row items-center gap-2 rounded-full bg-primary-100 px-4 py-2 dark:bg-primary-900/40"
            >
              <Ionicons name="add-circle" size={20} color="#16a34a" />
              <Text className="font-sans-medium text-primary-700 dark:text-primary-300">
                Log Meal
              </Text>
            </Pressable>
            <Pressable
              onPress={handleQuickAdd}
              className="flex-row items-center gap-2 rounded-full bg-slate-100 px-4 py-2 dark:bg-slate-700"
            >
              <Ionicons name="flash" size={20} color="#475569" />
              <Text className="font-sans-medium text-text dark:text-slate-300">
                Quick Add
              </Text>
            </Pressable>
            <Pressable
              onPress={handleScan}
              className="flex-row items-center gap-2 rounded-full bg-slate-100 px-4 py-2 dark:bg-slate-700"
            >
              <Ionicons name="barcode" size={20} color="#475569" />
              <Text className="font-sans-medium text-text dark:text-slate-300">
                Scan
              </Text>
            </Pressable>
          </View>

          <Text className="pt-4 text-lg font-sans-semibold text-text dark:text-slate-100">
            Today&apos;s Meals
          </Text>

          {mealOrder.some((t) => mealsByType[t]?.length) ? (
            mealOrder.map((type) => {
              const meals = mealsByType[type] ?? [];
              if (meals.length === 0) return null;
              return (
                <MealCard key={type} type={type} meals={meals} />
              );
            })
          ) : (
            <EmptyState
              icon="nutrition"
              title="No meals logged yet"
              subtitle="Log your first meal to see your progress"
              actionLabel="Log Meal"
              onAction={handleLogMeal}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

interface MealCardProps {
  type: string;
  meals: DashboardMeal[];
}

function MealCard({ type, meals }: MealCardProps) {
  const [expanded, setExpanded] = useState(false);
  const totalCal = meals.reduce((s, m) => s + m.totalCalories, 0);
  const foodNames = meals.flatMap((m) => m.items.map((i) => i.snapshotFoodName)).filter(Boolean);

  return (
    <Card
      pressable
      onPress={() => setExpanded((e) => !e)}
      className="mb-3"
    >
      <View className="flex-row items-center justify-between">
        <Text className="font-sans-semibold text-text dark:text-slate-100">
          {MEAL_TYPE_LABELS[type] ?? type}
        </Text>
        <Text className="text-sm text-text-secondary dark:text-slate-400">
          {totalCal} kcal
        </Text>
      </View>
      <Text
        className="mt-1 text-sm text-text-secondary dark:text-slate-400"
        numberOfLines={expanded ? undefined : 1}
      >
        {foodNames.join(', ') || 'Quick add'}
      </Text>
      {expanded && (
        <View className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-600">
          {meals.flatMap((m) =>
            m.items.map((item) => (
              <View key={item.id} className="flex-row justify-between py-1">
                <Text className="text-sm text-text dark:text-slate-200">
                  {item.snapshotFoodName}
                </Text>
                <Text className="text-sm text-text-secondary dark:text-slate-400">
                  {item.snapshotCalories} kcal
                </Text>
              </View>
            ))
          )}
        </View>
      )}
      <View className="mt-2 flex-row justify-end">
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#94a3b8"
        />
      </View>
    </Card>
  );
}
