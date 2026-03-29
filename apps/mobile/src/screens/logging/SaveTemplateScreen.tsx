import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BackButton, Input, Button, Card } from '../../components/ui';
import { mealsApi } from '../../api/meals';
import { useLocale } from '../../i18n';
import { useColors } from '../../theme';
import type { LogStackScreenProps } from '../../navigation/types';

type Props = LogStackScreenProps<'SaveTemplate'>;

const MEAL_TYPES = [
  { key: 'breakfast', icon: 'sunny-outline' as const },
  { key: 'lunch', icon: 'restaurant-outline' as const },
  { key: 'dinner', icon: 'moon-outline' as const },
  { key: 'snack', icon: 'cafe-outline' as const },
];

export function SaveTemplateScreen() {
  const { t } = useLocale();
  const c = useColors();
  const navigation = useNavigation<Props['navigation']>();
  const route = useRoute<Props['route']>();
  const insets = useSafeAreaInsets();
  const { mealLogId, mealType: initialMealType, itemNames } = route.params;

  const [name, setName] = useState('');
  const [mealType, setMealType] = useState<string | undefined>(initialMealType);
  const [saving, setSaving] = useState(false);

  const handleMealTypeSelect = (key: string) => {
    Haptics.selectionAsync();
    setMealType(mealType === key ? undefined : key);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('template.nameRequired'), t('template.nameRequiredDesc'));
      return;
    }

    setSaving(true);
    try {
      await mealsApi.createTemplateFromLog(mealLogId, name.trim(), mealType);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch {
      Alert.alert(t('common.error'), t('template.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-app" edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center px-5 py-3">
          <BackButton />
          <Text className="ml-3 text-lg font-sans-semibold text-text">
            {t('template.saveAsTemplate')}
          </Text>
        </View>

        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
        >
          <View className="px-5 pt-6">
            {/* Template name */}
            <Animated.View entering={FadeInDown.duration(300).delay(50)}>
              <Text className="text-xs font-sans-semibold text-text-tertiary uppercase tracking-wider mb-2">
                {t('template.templateName')}
              </Text>
              <Input
                value={name}
                onChangeText={setName}
                placeholder={t('template.templateNamePlaceholder')}
                maxLength={200}
                autoFocus
                accessibilityLabel={t('template.templateName')}
                containerClassName="mb-6"
              />
            </Animated.View>

            {/* Meal type */}
            <Animated.View entering={FadeInDown.duration(300).delay(100)}>
              <Text className="text-xs font-sans-semibold text-text-tertiary uppercase tracking-wider mb-2">
                {t('template.defaultMealType')}
              </Text>
              <View className="flex-row gap-2 mb-6">
                {MEAL_TYPES.map((mt) => {
                  const isSelected = mealType === mt.key;
                  return (
                    <Pressable
                      key={mt.key}
                      onPress={() => handleMealTypeSelect(mt.key)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={t(`mealTypes.${mt.key}`)}
                      className={`flex-1 items-center py-3 rounded-2xl ${
                        isSelected ? 'bg-primary-500' : 'bg-surface-card'
                      }`}
                    >
                      <Ionicons
                        name={mt.icon}
                        size={18}
                        color={isSelected ? c.onPrimary : c.textTertiary}
                      />
                      <Text
                        className={`text-xs font-sans-medium mt-1 ${
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

            {/* Items preview */}
            <Animated.View entering={FadeInDown.duration(300).delay(150)}>
              <Text className="text-xs font-sans-semibold text-text-tertiary uppercase tracking-wider mb-2">
                {t('template.itemsInMeal')}
              </Text>
              <Card>
                {itemNames.map((itemName, idx) => (
                  <View
                    key={`item-${idx}`}
                    className={`flex-row items-center py-3 ${
                      idx > 0 ? 'border-t border-surface-border' : ''
                    }`}
                  >
                    <View className="h-8 w-8 rounded-xl bg-surface-secondary items-center justify-center mr-3">
                      <Ionicons name="nutrition-outline" size={16} color={c.textTertiary} />
                    </View>
                    <Text className="text-sm font-sans-medium text-text flex-1" numberOfLines={1}>
                      {itemName}
                    </Text>
                  </View>
                ))}
              </Card>
            </Animated.View>
          </View>
        </ScrollView>

        {/* Save button */}
        <View className="px-5 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 24) }}>
          <Button
            onPress={handleSave}
            loading={saving}
            disabled={saving || !name.trim()}
            accessibilityLabel={t('template.saveTemplate')}
          >
            {t('template.saveTemplate')}
          </Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
