import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BackButton, Button, Card } from '../../components/ui';
import { mealsApi, type MealTemplateDetailItem } from '../../api/meals';
import { useColors } from '../../theme';
import { useLocale } from '../../i18n';
import type { LogStackScreenProps } from '../../navigation/types';

type Props = LogStackScreenProps<'LogTemplate'>;

interface StagedItem extends MealTemplateDetailItem {
  adjustedQuantity: number;
  removed: boolean;
}

const MEAL_TYPES = [
  { key: 'breakfast', icon: 'sunny-outline' as const },
  { key: 'lunch', icon: 'restaurant-outline' as const },
  { key: 'dinner', icon: 'moon-outline' as const },
  { key: 'snack', icon: 'cafe-outline' as const },
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
  const { t } = useLocale();
  const insets = useSafeAreaInsets();

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
      .catch(() => Alert.alert(t('common.error'), t('template.loadFailed')))
      .finally(() => setLoading(false));
  }, [templateId, t]);

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const newQty = Math.max(0.5, item.adjustedQuantity + delta);
        return { ...item, adjustedQuantity: Number(newQty.toFixed(1)) };
      }),
    );
  }, []);

  const toggleRemove = useCallback((itemId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, removed: !item.removed } : item)),
    );
  }, []);

  const handleMealTypeSelect = (key: string) => {
    Haptics.selectionAsync();
    setMealType(key);
  };

  const handleLog = async () => {
    if (activeItems.length === 0) {
      Alert.alert(t('template.noItems'), t('template.noItemsDesc'));
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.getParent()?.goBack();
    } catch {
      Alert.alert(t('common.error'), t('template.logFailed'));
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
      <View className="flex-row items-center px-5 py-3">
        <BackButton />
        <View className="ml-3 flex-1">
          <Text className="text-lg font-sans-semibold text-text" numberOfLines={1}>
            {templateName}
          </Text>
          <Text className="text-xs text-text-tertiary font-sans-medium">
            {t('template.adjustBeforeLog')}
          </Text>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Meal type selector */}
        <Animated.View entering={FadeInDown.duration(300).delay(50)} className="px-5 pt-4 pb-2">
          <Text className="text-xs font-sans-semibold text-text-tertiary uppercase tracking-wider mb-2">
            {t('quickAdd.mealType')}
          </Text>
          <View className="flex-row gap-2">
            {MEAL_TYPES.map((mt) => {
              const isSelected = mealType === mt.key;
              return (
                <Pressable
                  key={mt.key}
                  onPress={() => handleMealTypeSelect(mt.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={t(`mealTypes.${mt.key}`)}
                  className={`flex-1 items-center py-2.5 rounded-2xl ${
                    isSelected ? 'bg-primary-500' : 'bg-surface-card'
                  }`}
                >
                  <Ionicons
                    name={mt.icon}
                    size={16}
                    color={isSelected ? c.onPrimary : c.textTertiary}
                  />
                  <Text
                    className={`text-xs font-sans-medium mt-0.5 ${
                      isSelected ? 'text-on-primary' : 'text-text-tertiary'
                    }`}
                  >
                    {t(`mealTypes.${mt.key}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        {/* Items */}
        <View className="px-5 pt-4">
          <Text className="text-xs font-sans-semibold text-text-tertiary uppercase tracking-wider mb-2">
            {t('template.items')} ({activeItems.length})
          </Text>

          {items.map((item, index) => {
            const ratio = item.adjustedQuantity / item.quantity;
            const itemCal = item.estimatedNutrition
              ? Math.round(item.estimatedNutrition.calories * ratio)
              : 0;

            return (
              <Animated.View
                key={item.id}
                entering={FadeInDown.duration(250).delay(Math.min(index * 40, 200) + 100)}
              >
                <Card className={`mb-2 ${item.removed ? 'opacity-40' : ''}`}>
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-1 mr-3">
                      <Text className="text-sm font-sans-semibold text-text" numberOfLines={1}>
                        {item.foodName}
                      </Text>
                      <Text className="text-xs text-text-tertiary font-sans-medium mt-0.5">
                        {item.servingLabel} · {itemCal} kcal
                      </Text>
                    </View>

                    {/* Remove/restore toggle */}
                    <Pressable
                      onPress={() => toggleRemove(item.id)}
                      accessibilityRole="button"
                      accessibilityLabel={item.removed ? 'Restore item' : 'Remove item'}
                      className={`h-9 w-9 rounded-full items-center justify-center ${
                        item.removed ? 'bg-surface-secondary' : 'bg-danger/10'
                      }`}
                    >
                      <Ionicons
                        name={item.removed ? 'add' : 'close'}
                        size={16}
                        color={item.removed ? c.textSecondary : c.danger}
                      />
                    </Pressable>
                  </View>

                  {/* Quantity adjuster */}
                  {!item.removed && (
                    <View className="flex-row items-center justify-center gap-5">
                      <Pressable
                        onPress={() => adjustQuantity(item.id, -0.5)}
                        accessibilityRole="button"
                        accessibilityLabel="Decrease quantity"
                        className="h-10 w-10 rounded-xl bg-surface-secondary items-center justify-center active:opacity-70"
                      >
                        <Ionicons name="remove" size={18} color={c.text} />
                      </Pressable>
                      <Text className="text-lg font-sans-bold text-text min-w-[48px] text-center">
                        {item.adjustedQuantity}
                      </Text>
                      <Pressable
                        onPress={() => adjustQuantity(item.id, 0.5)}
                        accessibilityRole="button"
                        accessibilityLabel="Increase quantity"
                        className="h-10 w-10 rounded-xl bg-surface-secondary items-center justify-center active:opacity-70"
                      >
                        <Ionicons name="add" size={18} color={c.text} />
                      </Pressable>
                    </View>
                  )}
                </Card>
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>

      {/* Bottom bar with totals + log button */}
      <View
        className="absolute bottom-0 left-0 right-0 border-t border-surface-border bg-surface-card px-5 pt-4"
        style={{ paddingBottom: Math.max(insets.bottom, 24) }}
      >
        {/* Macro summary */}
        <View className="flex-row justify-between mb-4">
          <View className="items-center flex-1">
            <Text className="text-lg font-sans-bold text-text">{totals.calories}</Text>
            <Text className="text-xs text-text-tertiary font-sans-medium">kcal</Text>
          </View>
          <View className="items-center flex-1">
            <Text className="text-lg font-sans-bold text-text">{totals.protein.toFixed(0)}g</Text>
            <Text className="text-xs text-text-tertiary font-sans-medium">
              {t('dashboard.protein')}
            </Text>
          </View>
          <View className="items-center flex-1">
            <Text className="text-lg font-sans-bold text-warning">{totals.carbs.toFixed(0)}g</Text>
            <Text className="text-xs text-text-tertiary font-sans-medium">
              {t('dashboard.carbs')}
            </Text>
          </View>
          <View className="items-center flex-1">
            <Text className="text-lg font-sans-bold text-danger">{totals.fat.toFixed(0)}g</Text>
            <Text className="text-xs text-text-tertiary font-sans-medium">
              {t('dashboard.fat')}
            </Text>
          </View>
        </View>

        <Button
          onPress={handleLog}
          loading={logging}
          disabled={logging || activeItems.length === 0}
          accessibilityLabel={t('template.logMeal')}
        >
          {t('template.logMeal')}
        </Button>
      </View>
    </SafeAreaView>
  );
}
