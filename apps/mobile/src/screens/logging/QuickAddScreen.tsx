import { useState } from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BackButton, Input, Button, Card } from '../../components/ui';
import { mealsApi } from '../../api/meals';
import { useLocale } from '../../i18n';
import { useColors } from '../../theme';
import type { LogStackScreenProps } from '../../navigation/types';

type Props = LogStackScreenProps<'QuickAdd'>;

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

const MEAL_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  breakfast: 'sunny-outline',
  lunch: 'restaurant-outline',
  dinner: 'moon-outline',
  snack: 'cafe-outline',
};

export function QuickAddScreen() {
  const { t } = useLocale();
  const c = useColors();
  const navigation = useNavigation<Props['navigation']>();
  const insets = useSafeAreaInsets();
  const [mealType, setMealType] = useState<(typeof MEAL_TYPES)[number]>('lunch');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [note, setNote] = useState('');
  const [showMacros, setShowMacros] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    const cal = parseInt(calories, 10);
    if (isNaN(cal) || cal < 0) {
      setError(t('quickAdd.enterValidCalories'));
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await mealsApi.quickAdd({
        mealType,
        calories: cal,
        proteinGrams: protein ? parseFloat(protein) || 0 : undefined,
        carbsGrams: carbs ? parseFloat(carbs) || 0 : undefined,
        fatGrams: fat ? parseFloat(fat) || 0 : undefined,
        note: note.trim() || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleMealTypeSelect = (type: (typeof MEAL_TYPES)[number]) => {
    Haptics.selectionAsync();
    setMealType(type);
  };

  const toggleMacros = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowMacros(!showMacros);
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-app" edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center px-5 py-3">
          <BackButton />
          <Text className="ml-3 text-lg font-sans-semibold text-text">{t('quickAdd.title')}</Text>
        </View>

        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}
        >
          <View className="px-5 pt-4">
            {/* Meal type chips */}
            <Animated.View entering={FadeInDown.duration(300).delay(50)}>
              <Text className="mb-2 text-xs font-sans-semibold text-text-tertiary uppercase tracking-wider">
                {t('quickAdd.mealType')}
              </Text>
              <View className="mb-6 flex-row gap-2">
                {MEAL_TYPES.map((type) => {
                  const isSelected = mealType === type;
                  return (
                    <Pressable
                      key={type}
                      onPress={() => handleMealTypeSelect(type)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={t(`mealTypes.${type}`)}
                      className={`flex-1 items-center rounded-2xl py-3 ${
                        isSelected ? 'bg-primary-500' : 'bg-surface-card'
                      }`}
                    >
                      <Ionicons
                        name={MEAL_ICONS[type]}
                        size={18}
                        color={isSelected ? c.onPrimary : c.textTertiary}
                      />
                      <Text
                        className={`text-xs font-sans-medium mt-1 ${
                          isSelected ? 'text-on-primary' : 'text-text-tertiary'
                        }`}
                      >
                        {t(`mealTypes.${type}`)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>

            {/* Calorie input */}
            <Animated.View entering={FadeInDown.duration(300).delay(100)}>
              <Text className="mb-2 text-xs font-sans-semibold text-text-tertiary uppercase tracking-wider">
                {t('quickAdd.calories')}
              </Text>
              <Input
                value={calories}
                onChangeText={setCalories}
                placeholder="0"
                keyboardType="number-pad"
                accessibilityLabel={t('quickAdd.calories')}
                containerClassName="mb-6"
              />
            </Animated.View>

            {/* Optional macros - collapsible */}
            <Animated.View entering={FadeInDown.duration(300).delay(150)}>
              <Pressable
                onPress={toggleMacros}
                accessibilityRole="button"
                accessibilityLabel={t('quickAdd.macroBreakdown')}
                accessibilityState={{ expanded: showMacros }}
                className="mb-4 flex-row items-center justify-between rounded-2xl bg-surface-card p-4"
              >
                <Text className="text-sm font-sans-medium text-text">
                  {t('quickAdd.macroBreakdown')}
                </Text>
                <Ionicons
                  name={showMacros ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={c.textTertiary}
                />
              </Pressable>
            </Animated.View>

            {showMacros && (
              <Animated.View entering={FadeInDown.duration(250)}>
                <Card className="mb-6">
                  <View className="gap-4">
                    <Input
                      label={t('quickAdd.proteinG')}
                      value={protein}
                      onChangeText={setProtein}
                      placeholder="0"
                      keyboardType="decimal-pad"
                      accessibilityLabel={t('quickAdd.proteinG')}
                    />
                    <Input
                      label={t('quickAdd.carbsG')}
                      value={carbs}
                      onChangeText={setCarbs}
                      placeholder="0"
                      keyboardType="decimal-pad"
                      accessibilityLabel={t('quickAdd.carbsG')}
                    />
                    <Input
                      label={t('quickAdd.fatG')}
                      value={fat}
                      onChangeText={setFat}
                      placeholder="0"
                      keyboardType="decimal-pad"
                      accessibilityLabel={t('quickAdd.fatG')}
                    />
                  </View>
                </Card>
              </Animated.View>
            )}

            {/* Note */}
            <Animated.View entering={FadeInDown.duration(300).delay(200)}>
              <Input
                label={t('quickAdd.note')}
                value={note}
                onChangeText={setNote}
                placeholder={t('quickAdd.notePlaceholder')}
                accessibilityLabel={t('quickAdd.note')}
                containerClassName="mb-6"
              />
            </Animated.View>

            {error ? (
              <View className="mb-4 rounded-2xl bg-danger/10 px-4 py-3">
                <Text className="text-center text-sm font-sans-medium text-danger">{error}</Text>
              </View>
            ) : null}

            <Animated.View entering={FadeInDown.duration(300).delay(250)}>
              <Button
                onPress={handleSave}
                loading={saving}
                disabled={saving || !calories.trim()}
                accessibilityLabel={t('common.save')}
              >
                {t('common.save')}
              </Button>
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
