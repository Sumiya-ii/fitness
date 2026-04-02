import { useCallback, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BackButton, Button, Input } from '../../components/ui';
import {
  useBodyCompositionStore,
  type BodyMeasurementEntry,
} from '../../stores/body-composition.store';
import { useProfileStore } from '../../stores/profile.store';
import { useWeightStore } from '../../stores/weight.store';
import { useLocale } from '../../i18n';
import { useColors } from '../../theme';

// ─── Category color maps (mirror ProgressScreen) ──────────────────────────────

const BF_CATEGORY_COLORS: Record<string, string> = {
  essential: '#ef4444',
  athletic: '#3b82f6',
  fitness: '#22c55e',
  average: '#f59e0b',
  obese: '#ef4444',
};

const BMI_CATEGORY_COLORS: Record<string, string> = {
  underweight: '#3b82f6',
  normal: '#22c55e',
  overweight: '#f59e0b',
  obese_class_1: '#f97316',
  obese_class_2: '#ef4444',
  obese_class_3: '#dc2626',
};

// ─── Result metric tile ───────────────────────────────────────────────────────

function ResultTile({
  label,
  value,
  unit,
  badge,
  badgeColor,
}: {
  label: string;
  value: string;
  unit?: string;
  badge?: string;
  badgeColor?: string;
}) {
  const c = useColors();
  return (
    <View className="flex-1 items-center rounded-xl bg-surface-secondary p-3">
      <Text className="text-[10px] text-text-tertiary font-sans-medium mb-1">{label}</Text>
      <Text className="text-xl font-sans-bold text-text">
        {value}
        {unit ? (
          <Text className="text-sm font-sans-medium text-text-secondary"> {unit}</Text>
        ) : null}
      </Text>
      {badge ? (
        <View
          className="rounded-full px-2 py-0.5 mt-1"
          style={{ backgroundColor: (badgeColor ?? c.textSecondary) + '20' }}
        >
          <Text
            className="text-[10px] font-sans-semibold"
            style={{ color: badgeColor ?? c.textSecondary }}
          >
            {badge}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function BodyCompositionLogScreen() {
  const c = useColors();
  const { t } = useLocale();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const { logMeasurement } = useBodyCompositionStore();
  const profile = useProfileStore();
  const { history: weightHistory } = useWeightStore();

  const isFemale = profile.gender === 'female';

  // Form inputs
  const [waistInput, setWaistInput] = useState('');
  const [neckInput, setNeckInput] = useState('');
  const [hipInput, setHipInput] = useState('');
  const [weightInput, setWeightInput] = useState('');

  // UI state
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<BodyMeasurementEntry | null>(null);

  // Auto-fill weight from latest weight log or profile
  useFocusEffect(
    useCallback(() => {
      const latestWeight =
        weightHistory.length > 0 ? weightHistory[0]?.weightKg : (profile.weightKg ?? null);
      if (latestWeight) {
        setWeightInput(String(latestWeight));
      }
      // Reset result when screen regains focus
      setResult(null);
    }, [weightHistory, profile.weightKg]),
  );

  const validate = useCallback((): string | null => {
    const waist = parseFloat(waistInput.replace(',', '.'));
    const neck = parseFloat(neckInput.replace(',', '.'));

    if (!waistInput.trim() || isNaN(waist) || waist < 40 || waist > 200) {
      return t('bodyCompositionLog.waistRequired');
    }
    if (!neckInput.trim() || isNaN(neck) || neck < 20 || neck > 80) {
      return t('bodyCompositionLog.neckRequired');
    }
    if (isFemale) {
      const hip = parseFloat(hipInput.replace(',', '.'));
      if (!hipInput.trim() || isNaN(hip) || hip < 50 || hip > 200) {
        return t('bodyCompositionLog.hipRequired');
      }
    }
    return null;
  }, [waistInput, neckInput, hipInput, isFemale, t]);

  const handleSave = useCallback(async () => {
    const error = validate();
    if (error) {
      Alert.alert(t('common.error'), error);
      return;
    }

    const waistCm = parseFloat(waistInput.replace(',', '.'));
    const neckCm = parseFloat(neckInput.replace(',', '.'));
    const hipCm = isFemale || hipInput.trim() ? parseFloat(hipInput.replace(',', '.')) : undefined;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);
    try {
      const entry = await logMeasurement({
        waistCm,
        neckCm,
        ...(hipCm !== undefined && !isNaN(hipCm) ? { hipCm } : {}),
      });
      setResult(entry);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert(t('common.error'), t('bodyCompositionLog.saveFailed'));
    } finally {
      setSaving(false);
    }
  }, [validate, waistInput, neckInput, hipInput, isFemale, logMeasurement, t]);

  const handleLogAnother = useCallback(() => {
    setResult(null);
    setWaistInput('');
    setNeckInput('');
    setHipInput('');
  }, []);

  const bfColor = result
    ? (BF_CATEGORY_COLORS[result.bodyFatCategory] ?? c.textSecondary)
    : c.textSecondary;
  const bmiColor = result
    ? (BMI_CATEGORY_COLORS[result.bmiCategory] ?? c.textSecondary)
    : c.textSecondary;

  return (
    <View className="flex-1 bg-surface-app">
      <SafeAreaView edges={['top']} className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-5 py-3">
          <BackButton />
          <Text className="flex-1 text-lg leading-7 font-sans-bold text-text text-center mr-11">
            {t('bodyCompositionLog.title')}
          </Text>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1"
        >
          <ScrollView
            className="flex-1"
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingBottom: Math.max(insets.bottom, 24) + 24,
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Result view ── */}
            {result ? (
              <Animated.View entering={FadeInDown.duration(400).springify()} className="mt-6">
                <View className="bg-surface-card rounded-2xl p-4 border border-surface-border mb-4">
                  <View className="flex-row items-center gap-2 mb-4">
                    <Ionicons name="checkmark-circle" size={20} color={c.success} />
                    <Text className="text-base font-sans-bold text-text">
                      {t('bodyCompositionLog.resultTitle')}
                    </Text>
                  </View>

                  {/* Body fat + BMI */}
                  <View className="flex-row gap-2 mb-2">
                    <ResultTile
                      label={t('bodyCompositionLog.bodyFat')}
                      value={`${result.bodyFatPercent}%`}
                      badge={result.bodyFatCategory}
                      badgeColor={bfColor}
                    />
                    <ResultTile
                      label={t('bodyCompositionLog.bmi')}
                      value={String(result.bmi)}
                      badge={result.bmiCategory.replace(/_/g, ' ')}
                      badgeColor={bmiColor}
                    />
                  </View>

                  {/* Fat mass + lean mass */}
                  <View className="flex-row gap-2 mb-4">
                    <ResultTile
                      label={t('bodyCompositionLog.fatMass')}
                      value={result.fatMassKg.toFixed(1)}
                      unit="kg"
                    />
                    <ResultTile
                      label={t('bodyCompositionLog.leanMass')}
                      value={result.leanMassKg.toFixed(1)}
                      unit="kg"
                    />
                  </View>

                  {/* Action buttons */}
                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <Button
                        variant="secondary"
                        size="md"
                        onPress={handleLogAnother}
                        accessibilityLabel={t('bodyCompositionLog.logAnother')}
                      >
                        {t('bodyCompositionLog.logAnother')}
                      </Button>
                    </View>
                    <View className="flex-1">
                      <Button
                        variant="primary"
                        size="md"
                        onPress={() => navigation.goBack()}
                        accessibilityLabel={t('bodyCompositionLog.done')}
                      >
                        {t('bodyCompositionLog.done')}
                      </Button>
                    </View>
                  </View>
                </View>
              </Animated.View>
            ) : (
              <>
                {/* ── Subtitle ── */}
                <Animated.View
                  entering={FadeInDown.duration(400).springify()}
                  className="mt-6 mb-4"
                >
                  <Text className="text-sm text-text-secondary leading-5">
                    {t('bodyCompositionLog.subtitle')}
                  </Text>
                </Animated.View>

                {/* ── Form card ── */}
                <Animated.View
                  entering={FadeInDown.duration(400).delay(80).springify()}
                  className="mb-4"
                >
                  <View className="bg-surface-card rounded-2xl p-4 border border-surface-border">
                    {/* Weight (auto-filled, read-only display) */}
                    <View className="mb-4">
                      <Text className="text-sm font-sans-medium text-text-secondary mb-1.5">
                        {t('bodyCompositionLog.weightLabel')}
                      </Text>
                      <View className="flex-row items-center bg-surface-secondary rounded-xl px-4 py-3">
                        <Text className="flex-1 text-base font-sans-medium text-text">
                          {weightInput || '--'}
                        </Text>
                        <Text className="text-sm text-text-tertiary font-sans-medium">kg</Text>
                      </View>
                      <Text className="text-xs text-text-tertiary mt-1">
                        {t('bodyCompositionLog.weightNote')}
                      </Text>
                    </View>

                    {/* Waist */}
                    <Input
                      label={t('bodyCompositionLog.waist')}
                      placeholder={t('bodyCompositionLog.waistPlaceholder')}
                      value={waistInput}
                      onChangeText={setWaistInput}
                      keyboardType="decimal-pad"
                      containerClassName="mb-4"
                    />

                    {/* Neck */}
                    <Input
                      label={t('bodyCompositionLog.neck')}
                      placeholder={t('bodyCompositionLog.neckPlaceholder')}
                      value={neckInput}
                      onChangeText={setNeckInput}
                      keyboardType="decimal-pad"
                      containerClassName="mb-4"
                    />

                    {/* Hip — required for females, optional for males */}
                    <Input
                      label={
                        isFemale
                          ? t('bodyCompositionLog.hip')
                          : `${t('bodyCompositionLog.hip')} (${t('common.edit').toLowerCase()})`
                      }
                      placeholder={t('bodyCompositionLog.hipPlaceholder')}
                      value={hipInput}
                      onChangeText={setHipInput}
                      keyboardType="decimal-pad"
                      containerClassName="mb-4"
                    />

                    {isFemale && (
                      <View
                        className="flex-row items-start rounded-xl p-3 mb-4"
                        style={{ backgroundColor: `${c.primary}0d` }}
                      >
                        <Ionicons
                          name="information-circle-outline"
                          size={15}
                          color={c.textSecondary}
                          style={{ marginTop: 1 }}
                        />
                        <Text className="text-xs text-text-secondary ml-2 flex-1 leading-5">
                          {t('bodyCompositionLog.hipRequired')}
                        </Text>
                      </View>
                    )}

                    <Button
                      variant="primary"
                      size="lg"
                      onPress={handleSave}
                      loading={saving}
                      accessibilityLabel={t('bodyCompositionLog.calculateSave')}
                    >
                      {t('bodyCompositionLog.calculateSave')}
                    </Button>
                  </View>
                </Animated.View>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
