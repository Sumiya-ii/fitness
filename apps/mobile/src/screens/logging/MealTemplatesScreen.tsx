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
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BackButton, Card, EmptyState } from '../../components/ui';
import { mealsApi, type MealTemplate } from '../../api/meals';
import { useColors } from '../../theme';
import { useLocale } from '../../i18n';
import type { LogStackScreenProps } from '../../navigation/types';

type Props = LogStackScreenProps<'MealTemplates'>;

export function MealTemplatesScreen() {
  const navigation = useNavigation<Props['navigation']>();
  const c = useColors();
  const { t } = useLocale();
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(t('template.deleteTitle'), t('template.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await mealsApi.deleteTemplate(template.id);
            setTemplates((prev) => prev.filter((tmpl) => tmpl.id !== template.id));
          } catch {
            // ignore
          }
        },
      },
    ]);
  };

  const itemCountLabel = (template: MealTemplate) => {
    const count = template.items.length;
    return `${count} ${count !== 1 ? t('template.items') : t('template.items')}`;
  };

  const renderTemplate = ({ item, index }: { item: MealTemplate; index: number }) => (
    <Animated.View entering={FadeInDown.duration(300).delay(Math.min(index * 40, 200))}>
      <Card
        pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          navigation.navigate('LogTemplate', { templateId: item.id });
        }}
        className="mb-3"
      >
        <Pressable
          onLongPress={() => handleDelete(item)}
          accessibilityRole="button"
          accessibilityLabel={item.name}
        >
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center gap-3 flex-1 mr-3">
              <View className="h-10 w-10 rounded-2xl bg-surface-secondary items-center justify-center">
                <Ionicons name="restaurant" size={20} color={c.textSecondary} />
              </View>
              <View className="flex-1">
                <Text className="text-base font-sans-semibold text-text" numberOfLines={1}>
                  {item.name}
                </Text>
                <Text className="text-xs text-text-tertiary font-sans-medium mt-0.5">
                  {item.mealType ? t(`mealTypes.${item.mealType}`) : t('template.anyMeal')} ·{' '}
                  {itemCountLabel(item)}
                </Text>
              </View>
            </View>
            <View className="h-9 w-9 rounded-full bg-surface-secondary items-center justify-center">
              <Ionicons name="add" size={18} color={c.textSecondary} />
            </View>
          </View>

          {/* Food items preview */}
          <View className="ml-[52px]">
            {item.items.slice(0, 3).map((food, idx) => (
              <Text
                key={food.id}
                className="text-sm text-text-tertiary font-sans-medium leading-5"
                numberOfLines={1}
              >
                {food.quantity}x {food.servingLabel} {food.foodName}
                {idx === 2 && item.items.length > 3 ? ` +${item.items.length - 3}` : ''}
              </Text>
            ))}
          </View>

          {/* Usage stats */}
          {item.usageCount > 0 && (
            <View className="flex-row items-center mt-2 ml-[52px]">
              <Ionicons name="repeat" size={12} color={c.textTertiary} />
              <Text className="text-xs text-text-tertiary font-sans-medium ml-1">
                {item.usageCount === 1
                  ? t('template.usedOnce')
                  : t('template.usedTimes').replace('{{count}}', String(item.usageCount))}
              </Text>
            </View>
          )}
        </Pressable>
      </Card>
    </Animated.View>
  );

  return (
    <SafeAreaView className="flex-1 bg-surface-app" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-5 py-3">
        <BackButton />
        <Text className="ml-3 text-lg font-sans-semibold text-text">{t('template.myMeals')}</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      ) : templates.length === 0 ? (
        <EmptyState
          icon="list"
          title={t('template.noSavedMeals')}
          subtitle={t('template.noSavedMealsDesc')}
        />
      ) : (
        <FlatList
          data={templates}
          keyExtractor={(item) => item.id}
          renderItem={renderTemplate}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />
          }
        />
      )}
    </SafeAreaView>
  );
}
