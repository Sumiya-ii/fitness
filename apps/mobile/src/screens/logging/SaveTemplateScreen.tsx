import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { BackButton } from '../../components/ui';
import { mealsApi } from '../../api/meals';
import { useLocale } from '../../i18n';
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
  const navigation = useNavigation<Props['navigation']>();
  const route = useRoute<Props['route']>();
  const { mealLogId, mealType: initialMealType, itemNames } = route.params;

  const [name, setName] = useState('');
  const [mealType, setMealType] = useState<string | undefined>(initialMealType);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('template.nameRequired'), t('template.nameRequiredDesc'));
      return;
    }

    setSaving(true);
    try {
      await mealsApi.createTemplateFromLog(mealLogId, name.trim(), mealType);
      navigation.goBack();
    } catch {
      Alert.alert(t('common.error'), t('template.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-row items-center border-b border-[#2c2c2e] px-4 py-3">
          <BackButton />
          <Text className="ml-3 text-lg font-sans-semibold text-white">
            {t('template.saveAsTemplate')}
          </Text>
        </View>

        <ScrollView className="flex-1 px-5 pt-6" keyboardShouldPersistTaps="handled">
          {/* Template name */}
          <Text className="text-sm font-sans-semibold text-[#71717a] uppercase tracking-wider mb-2">
            {t('template.templateName')}
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t('template.templateNamePlaceholder')}
            placeholderTextColor="#71717a"
            maxLength={200}
            autoFocus
            className="rounded-2xl px-4 py-4 text-base font-sans-medium text-white mb-6"
            style={{
              backgroundColor: '#1c1c1e',
              shadowColor: '#000000',
              shadowOpacity: 0.05,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              elevation: 2,
            }}
          />

          {/* Meal type */}
          <Text className="text-sm font-sans-semibold text-[#71717a] uppercase tracking-wider mb-2">
            {t('template.defaultMealType')}
          </Text>
          <View className="flex-row gap-2 mb-6">
            {MEAL_TYPES.map((mt) => (
              <Pressable
                key={mt.key}
                onPress={() => setMealType(mealType === mt.key ? undefined : mt.key)}
                className={`flex-1 items-center py-3 rounded-2xl ${
                  mealType === mt.key ? 'bg-white' : 'bg-[#1c1c1e]'
                }`}
                style={{
                  shadowColor: '#000000',
                  shadowOpacity: 0.05,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 2,
                }}
              >
                <Ionicons
                  name={mt.icon}
                  size={18}
                  color={mealType === mt.key ? '#000000' : '#71717a'}
                />
                <Text
                  className={`text-xs font-sans-medium mt-1 ${
                    mealType === mt.key ? 'text-black' : 'text-[#71717a]'
                  }`}
                >
                  {t(`mealTypes.${mt.key}`)}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Items preview */}
          <Text className="text-sm font-sans-semibold text-[#71717a] uppercase tracking-wider mb-2">
            {t('template.itemsInMeal')}
          </Text>
          <View
            className="rounded-2xl p-4"
            style={{
              backgroundColor: '#1c1c1e',
              shadowColor: '#000000',
              shadowOpacity: 0.05,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              elevation: 2,
            }}
          >
            {itemNames.map((itemName, idx) => (
              <View
                key={`item-${idx}`}
                className="flex-row items-center py-2"
                style={idx > 0 ? { borderTopWidth: 1, borderTopColor: '#2c2c2e' } : undefined}
              >
                <View className="h-8 w-8 rounded-xl bg-black items-center justify-center mr-3">
                  <Text style={{ fontSize: 16 }}>🍽️</Text>
                </View>
                <Text className="text-sm font-sans-medium text-white flex-1" numberOfLines={1}>
                  {itemName}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Save button */}
        <View className="px-5 pb-6 pt-3">
          <Pressable
            onPress={handleSave}
            disabled={saving || !name.trim()}
            className={`rounded-2xl py-4 items-center ${
              saving || !name.trim() ? 'bg-[#3a3a3c]' : 'bg-white'
            }`}
            style={{
              shadowColor: '#000000',
              shadowOpacity: 0.2,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
              elevation: 4,
            }}
          >
            {saving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-base font-sans-bold text-black">
                {t('template.saveTemplate')}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
