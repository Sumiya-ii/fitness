import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Input, Button, Card } from '../../components/ui';
import { mealsApi } from '../../api/meals';
import type { LogStackScreenProps } from '../../navigation/types';

type Props = LogStackScreenProps<'QuickAdd'>;

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

export function QuickAddScreen() {
  const navigation = useNavigation<Props['navigation']>();
  const [mealType, setMealType] = useState<typeof MEAL_TYPES[number]>('lunch');
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
      setError('Enter valid calories');
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
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center border-b border-surface-border px-4 py-3">
          <Pressable onPress={() => navigation.goBack()} className="p-3 -m-3">
            <Ionicons name="arrow-back" size={24} color="#111218" />
          </Pressable>
          <Text className="ml-4 text-lg font-sans-semibold text-text">
            Quick Add
          </Text>
        </View>

        <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
          <View className="p-4">
            {/* Meal type chips */}
            <Text className="mb-2 text-sm font-sans-medium text-text-secondary">
              Meal type
            </Text>
            <View className="mb-6 flex-row flex-wrap gap-2">
              {MEAL_TYPES.map((type) => (
                <Pressable
                  key={type}
                  onPress={() => setMealType(type)}
                  className={`rounded-full px-4 py-2 ${
                    mealType === type
                      ? 'bg-primary-500'
                      : 'bg-surface-secondary'
                  }`}
                >
                  <Text
                    className={`font-sans-medium capitalize ${
                      mealType === type
                        ? 'text-text-inverse'
                        : 'text-text-secondary'
                    }`}
                  >
                    {type}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Calorie input */}
            <Text className="mb-2 text-sm font-sans-medium text-text-secondary">
              Calories
            </Text>
            <Input
              value={calories}
              onChangeText={setCalories}
              placeholder="0"
              keyboardType="number-pad"
              className="mb-6 text-center text-3xl"
            />

            {/* Optional macros - collapsible */}
            <Pressable
              onPress={() => setShowMacros(!showMacros)}
              className="mb-4 flex-row items-center justify-between"
            >
              <Text className="text-sm font-sans-medium text-text-secondary">
                Macro breakdown (optional)
              </Text>
              <Ionicons
                name={showMacros ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#9a9caa"
              />
            </Pressable>
            {showMacros && (
              <Card className="mb-6">
                <Input
                  label="Protein (g)"
                  value={protein}
                  onChangeText={setProtein}
                  placeholder="0"
                  keyboardType="decimal-pad"
                  className="mb-3"
                />
                <Input
                  label="Carbs (g)"
                  value={carbs}
                  onChangeText={setCarbs}
                  placeholder="0"
                  keyboardType="decimal-pad"
                  className="mb-3"
                />
                <Input
                  label="Fat (g)"
                  value={fat}
                  onChangeText={setFat}
                  placeholder="0"
                  keyboardType="decimal-pad"
                />
              </Card>
            )}

            {/* Note */}
            <Input
              label="Note (optional)"
              value={note}
              onChangeText={setNote}
              placeholder="e.g. Homemade salad"
              className="mb-6"
            />

            {error && (
              <Text className="mb-4 text-center text-danger">{error}</Text>
            )}

            <Button onPress={handleSave} loading={saving} disabled={saving}>
              Save
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
