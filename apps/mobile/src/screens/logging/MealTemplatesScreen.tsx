import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { BackButton, EmptyState } from '../../components/ui';
import { mealsApi, type MealTemplate } from '../../api/meals';
import { useColors } from '../../theme';
import type { LogStackScreenProps } from '../../navigation/types';

type Props = LogStackScreenProps<'MealTemplates'>;

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

export function MealTemplatesScreen() {
  const navigation = useNavigation<Props['navigation']>();
  const c = useColors();
  const [templates, setTemplates] = useState<MealTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await mealsApi.getMealTemplates(1, 50);
      setTemplates(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTemplates();
    }, [loadTemplates]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadTemplates();
  }, [loadTemplates]);

  const handleDelete = (template: MealTemplate) => {
    Alert.alert('Delete Template', `Remove "${template.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await mealsApi.deleteTemplate(template.id);
            setTemplates((prev) => prev.filter((t) => t.id !== template.id));
          } catch {
            // ignore
          }
        },
      },
    ]);
  };

  const estimatedCalories = (template: MealTemplate) => {
    // Quick estimate from items count — actual calories shown on detail screen
    return `${template.items.length} item${template.items.length !== 1 ? 's' : ''}`;
  };

  const renderTemplate = ({ item }: { item: MealTemplate }) => (
    <Pressable
      onPress={() => navigation.navigate('LogTemplate', { templateId: item.id })}
      onLongPress={() => handleDelete(item)}
      className="rounded-3xl p-4 mb-3"
      style={{
        backgroundColor: c.card,
        shadowColor: c.shadow,
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
      }}
    >
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center gap-2 flex-1 mr-3">
          <View className="h-10 w-10 rounded-2xl bg-primary-50 items-center justify-center">
            <Ionicons name="restaurant" size={20} color={c.primaryMuted} />
          </View>
          <View className="flex-1">
            <Text className="text-base font-sans-bold text-text" numberOfLines={1}>
              {item.name}
            </Text>
            <Text className="text-xs text-text-tertiary font-sans-medium mt-0.5">
              {item.mealType ? MEAL_TYPE_LABELS[item.mealType] : 'Any meal'} ·{' '}
              {estimatedCalories(item)}
            </Text>
          </View>
        </View>
        <View className="items-end">
          <View className="h-8 w-8 rounded-full bg-primary-50 items-center justify-center">
            <Ionicons name="add" size={18} color={c.primaryMuted} />
          </View>
        </View>
      </View>

      {/* Food items preview */}
      <View className="ml-12">
        {item.items.slice(0, 3).map((food, idx) => (
          <Text
            key={food.id}
            className="text-sm text-text-tertiary font-sans-medium"
            numberOfLines={1}
          >
            {food.quantity}x {food.servingLabel} {food.foodName}
            {idx === 2 && item.items.length > 3 ? ` +${item.items.length - 3} more` : ''}
          </Text>
        ))}
      </View>

      {/* Usage stats */}
      {item.usageCount > 0 && (
        <View className="flex-row items-center mt-2 ml-12">
          <Ionicons name="repeat" size={12} color={c.textTertiary} />
          <Text className="text-xs text-text-tertiary font-sans-medium ml-1">
            Used {item.usageCount} time{item.usageCount !== 1 ? 's' : ''}
          </Text>
        </View>
      )}
    </Pressable>
  );

  return (
    <SafeAreaView className="flex-1 bg-surface-app" edges={['top']}>
      <View className="flex-row items-center border-b border-surface-border px-4 py-3">
        <BackButton />
        <Text className="ml-3 text-lg font-sans-semibold text-text">My Meals</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center py-16">
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      ) : templates.length === 0 ? (
        <EmptyState
          icon="list"
          title="No saved meals yet"
          subtitle="Save a meal from your diary to quickly re-log it later"
        />
      ) : (
        <FlatList
          data={templates}
          keyExtractor={(item) => item.id}
          renderItem={renderTemplate}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />
          }
        />
      )}
    </SafeAreaView>
  );
}
