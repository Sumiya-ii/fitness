import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { BackButton } from '../../components/ui';
import { mealsApi, type MealTemplateDetailItem } from '../../api/meals';
import { useColors } from '../../theme';
import type { LogStackScreenProps } from '../../navigation/types';

type Props = LogStackScreenProps<'LogTemplate'>;

interface StagedItem extends MealTemplateDetailItem {
  adjustedQuantity: number;
  removed: boolean;
}

const MEAL_TYPES = [
  { key: 'breakfast', label: 'Breakfast', icon: 'sunny-outline' as const },
  { key: 'lunch', label: 'Lunch', icon: 'restaurant-outline' as const },
  { key: 'dinner', label: 'Dinner', icon: 'moon-outline' as const },
  { key: 'snack', label: 'Snack', icon: 'cafe-outline' as const },
];

function guessDefaultMealType(): string {
  const hour = new Date().getHours();
  if (hour < 10) return 'breakfast';
  if (hour < 14) return 'lunch';
  if (hour < 18) return 'snack';
  return 'dinner';
}

export function LogTemplateScreen() {
  const navigation = useNavigation<Props['navigation']>();
  const route = useRoute<Props['route']>();
  const { templateId } = route.params;
  const c = useColors();

  const [templateName, setTemplateName] = useState('');
  const [items, setItems] = useState<StagedItem[]>([]);
  const [mealType, setMealType] = useState<string>(guessDefaultMealType());
  const [loading, setLoading] = useState(true);
  const [logging, setLogging] = useState(false);

  useEffect(() => {
    mealsApi
      .getMealTemplate(templateId)
      .then((res) => {
        const detail = res.data;
        setTemplateName(detail.name);
        if (detail.mealType) setMealType(detail.mealType);
        setItems(
          detail.items.map((item) => ({
            ...item,
            adjustedQuantity: item.quantity,
            removed: false,
          })),
        );
      })
      .catch(() => Alert.alert('Error', 'Failed to load template'))
      .finally(() => setLoading(false));
  }, [templateId]);

  const activeItems = items.filter((i) => !i.removed);

  const totals = activeItems.reduce(
    (acc, item) => {
      if (!item.estimatedNutrition) return acc;
      const ratio = item.adjustedQuantity / item.quantity;
      return {
        calories: acc.calories + Math.round(item.estimatedNutrition.calories * ratio),
        protein: acc.protein + item.estimatedNutrition.protein * ratio,
        carbs: acc.carbs + item.estimatedNutrition.carbs * ratio,
        fat: acc.fat + item.estimatedNutrition.fat * ratio,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  const adjustQuantity = useCallback((itemId: string, delta: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const newQty = Math.max(0.5, item.adjustedQuantity + delta);
        return { ...item, adjustedQuantity: Number(newQty.toFixed(1)) };
      }),
    );
  }, []);

  const toggleRemove = useCallback((itemId: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, removed: !item.removed } : item)),
    );
  }, []);

  const handleLog = async () => {
    if (activeItems.length === 0) {
      Alert.alert('No items', 'Add at least one item to log this meal.');
      return;
    }

    setLogging(true);
    try {
      await mealsApi.logTemplate(templateId, {
        mealType: mealType as 'breakfast' | 'lunch' | 'dinner' | 'snack',
        items: activeItems.map((item) => ({
          foodId: item.foodId,
          servingId: item.servingId,
          quantity: item.adjustedQuantity,
        })),
      });
      navigation.getParent()?.goBack();
    } catch {
      Alert.alert('Error', 'Failed to log meal. Please try again.');
    } finally {
      setLogging(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-surface-app items-center justify-center" edges={['top']}>
        <ActivityIndicator size="large" color={c.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-app" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center border-b border-surface-border px-4 py-3">
        <BackButton />
        <View className="ml-3 flex-1">
          <Text className="text-lg font-sans-semibold text-text" numberOfLines={1}>
            {templateName}
          </Text>
          <Text className="text-xs text-text-tertiary font-sans-medium">
            Adjust items before logging
          </Text>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Meal type selector */}
        <View className="px-4 pt-4 pb-2">
          <Text className="text-xs font-sans-semibold text-text-tertiary uppercase tracking-wider mb-2">
            Meal Type
          </Text>
          <View className="flex-row gap-2">
            {MEAL_TYPES.map((mt) => (
              <Pressable
                key={mt.key}
                onPress={() => setMealType(mt.key)}
                className={`flex-1 items-center py-2.5 rounded-xl ${
                  mealType === mt.key ? 'bg-primary-500' : 'bg-surface-card'
                }`}
              >
                <Ionicons
                  name={mt.icon}
                  size={16}
                  color={mealType === mt.key ? c.onPrimary : c.textTertiary}
                />
                <Text
                  className={`text-xs font-sans-medium mt-0.5 ${
                    mealType === mt.key ? 'text-on-primary' : 'text-text-tertiary'
                  }`}
                >
                  {mt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Items */}
        <View className="px-4 pt-4">
          <Text className="text-xs font-sans-semibold text-text-tertiary uppercase tracking-wider mb-2">
            Items ({activeItems.length})
          </Text>

          {items.map((item) => {
            const ratio = item.adjustedQuantity / item.quantity;
            const itemCal = item.estimatedNutrition
              ? Math.round(item.estimatedNutrition.calories * ratio)
              : 0;

            return (
              <View
                key={item.id}
                className={`rounded-2xl p-4 mb-2 ${item.removed ? 'opacity-40' : ''}`}
                style={{
                  backgroundColor: c.card,
                  shadowColor: c.shadow,
                  shadowOpacity: 0.04,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 1,
                }}
              >
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-1 mr-3">
                    <Text className="text-sm font-sans-bold text-text" numberOfLines={1}>
                      {item.foodName}
                    </Text>
                    <Text className="text-xs text-text-tertiary font-sans-medium">
                      {item.servingLabel} · {itemCal} kcal
                    </Text>
                  </View>

                  {/* Remove/restore toggle */}
                  <Pressable
                    onPress={() => toggleRemove(item.id)}
                    className={`h-8 w-8 rounded-full items-center justify-center ${
                      item.removed ? 'bg-surface-secondary' : 'bg-danger/10'
                    }`}
                  >
                    <Ionicons
                      name={item.removed ? 'add' : 'close'}
                      size={16}
                      color={item.removed ? '#3b5bdb' : '#ef4444'}
                    />
                  </Pressable>
                </View>

                {/* Quantity adjuster */}
                {!item.removed && (
                  <View className="flex-row items-center justify-center gap-4">
                    <Pressable
                      onPress={() => adjustQuantity(item.id, -0.5)}
                      className="h-9 w-9 rounded-xl bg-surface-app items-center justify-center"
                    >
                      <Ionicons name="remove" size={18} color={c.text} />
                    </Pressable>
                    <Text className="text-lg font-sans-bold text-text min-w-[48px] text-center">
                      {item.adjustedQuantity}
                    </Text>
                    <Pressable
                      onPress={() => adjustQuantity(item.id, 0.5)}
                      className="h-9 w-9 rounded-xl bg-surface-app items-center justify-center"
                    >
                      <Ionicons name="add" size={18} color={c.text} />
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Bottom bar with totals + log button */}
      <View
        className="absolute bottom-0 left-0 right-0 border-t border-surface-border px-5 pb-8 pt-4"
        style={{
          backgroundColor: c.card,
          shadowColor: c.shadow,
          shadowOpacity: 0.1,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: -4 },
          elevation: 8,
        }}
      >
        {/* Macro summary */}
        <View className="flex-row justify-between mb-4">
          <View className="items-center flex-1">
            <Text className="text-lg font-sans-bold text-text">{totals.calories}</Text>
            <Text className="text-xs text-text-tertiary font-sans-medium">kcal</Text>
          </View>
          <View className="items-center flex-1">
            <Text className="text-lg font-sans-bold text-[#3b5bdb]">
              {totals.protein.toFixed(0)}g
            </Text>
            <Text className="text-xs text-text-tertiary font-sans-medium">Protein</Text>
          </View>
          <View className="items-center flex-1">
            <Text className="text-lg font-sans-bold text-[#f59e0b]">
              {totals.carbs.toFixed(0)}g
            </Text>
            <Text className="text-xs text-text-tertiary font-sans-medium">Carbs</Text>
          </View>
          <View className="items-center flex-1">
            <Text className="text-lg font-sans-bold text-[#ef4444]">{totals.fat.toFixed(0)}g</Text>
            <Text className="text-xs text-text-tertiary font-sans-medium">Fat</Text>
          </View>
        </View>

        <Pressable
          onPress={handleLog}
          disabled={logging || activeItems.length === 0}
          className={`rounded-2xl py-4 items-center ${
            logging || activeItems.length === 0 ? 'bg-surface-tertiary' : 'bg-primary-500'
          }`}
        >
          {logging ? (
            <ActivityIndicator color={c.text} />
          ) : (
            <Text className="text-base font-sans-bold text-on-primary">Log Meal</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
