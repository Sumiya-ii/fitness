import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BackButton, Button, Input, SkeletonLoader } from '../../components/ui';
import { api } from '../../api';
import { useLocale } from '../../i18n';
import { useColors } from '../../theme';

// ─── Types ────────────────────────────────────────────────────────────────────

type GoalType = 'lose_fat' | 'maintain' | 'gain';

interface CurrentTarget {
  id: string;
  goalType: string;
  calorieTarget: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  weeklyRateKg: number;
  effectiveFrom: string;
}

interface NewTarget {
  calorieTarget: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  weeklyRateKg: number;
  goalType: string;
}

// ─── Goal selector option ─────────────────────────────────────────────────────

function GoalOption({
  value: _value,
  label,
  selected,
  onPress,
}: {
  value: GoalType;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      className={`flex-1 rounded-xl py-3 items-center border ${
        selected ? 'border-primary-500' : 'border-surface-border'
      }`}
      style={{ backgroundColor: selected ? `${c.primary}1a` : c.cardAlt }}
    >
      <Text
        className="text-xs font-sans-semibold text-center"
        style={{ color: selected ? c.primary : c.textSecondary }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Macro result row ─────────────────────────────────────────────────────────

function MacroRow({ label, value, unit }: { label: string; value: number; unit: string }) {
  const c = useColors();
  return (
    <View className="flex-row items-center justify-between py-2">
      <Text className="text-sm text-text-secondary font-sans-medium">{label}</Text>
      <Text className="text-sm font-sans-bold" style={{ color: c.text }}>
        {value} {unit}
      </Text>
    </View>
  );
}

// ─── Weekly rate slider steps ─────────────────────────────────────────────────

const RATE_STEPS = [0.25, 0.5, 0.75, 1.0];

function RateStepPicker({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const c = useColors();
  return (
    <View className="flex-row gap-2">
      {RATE_STEPS.map((step) => {
        const selected = value === step;
        return (
          <Pressable
            key={step}
            onPress={() => {
              if (!disabled) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onChange(step);
              }
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            className={`flex-1 rounded-xl py-3 items-center border ${
              selected ? 'border-primary-500' : 'border-surface-border'
            }`}
            style={{
              backgroundColor: selected ? `${c.primary}1a` : c.cardAlt,
              opacity: disabled ? 0.4 : 1,
            }}
          >
            <Text
              className="text-xs font-sans-bold"
              style={{ color: selected ? c.primary : c.textSecondary }}
            >
              {step}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function EditTargetsScreen() {
  const c = useColors();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState<CurrentTarget | null>(null);
  const [loadError, setLoadError] = useState(false);

  // Editable fields
  const [goalType, setGoalType] = useState<GoalType>('maintain');
  const [weeklyRateKg, setWeeklyRateKg] = useState(0.5);
  const [weightKgInput, setWeightKgInput] = useState('');

  // Preview state
  const [preview, setPreview] = useState<NewTarget | null>(null);
  const [calculating, setCalculating] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setLoadError(false);
      setPreview(null);
      api
        .get<{ data: CurrentTarget | null }>('/targets/current')
        .then((res) => {
          const target = res.data;
          setCurrent(target);
          if (target) {
            const gt = target.goalType as GoalType;
            setGoalType(gt);
            setWeeklyRateKg(target.weeklyRateKg > 0 ? Math.min(1.0, target.weeklyRateKg) : 0.5);
          }
        })
        .catch(() => setLoadError(true))
        .finally(() => setLoading(false));
    }, []),
  );

  const handleRecalculate = useCallback(async () => {
    const w = parseFloat(weightKgInput.replace(',', '.'));
    if (isNaN(w) || w < 30 || w > 500) {
      Alert.alert(t('common.error'), t('editTargets.invalidWeight'));
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCalculating(true);
    setPreview(null);
    try {
      const res = await api.post<{ data: NewTarget }>('/targets', {
        goalType,
        weeklyRateKg: goalType === 'maintain' ? 0 : weeklyRateKg,
        weightKg: w,
      });
      setPreview(res.data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert(t('common.error'), t('editTargets.saveFailed'));
    } finally {
      setCalculating(false);
    }
  }, [goalType, weeklyRateKg, weightKgInput, t]);

  // POST /targets saves and activates immediately (service deactivates previous)
  // so recalculate IS the save — but we show a preview step for UX confirmation.
  // When the user taps "Confirm & Save" we just update state — the target was
  // already persisted by the recalculate POST.
  const handleConfirmSave = useCallback(() => {
    if (!preview) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Refresh current from the saved preview
    setCurrent({
      id: '',
      goalType: preview.goalType,
      calorieTarget: preview.calorieTarget,
      proteinGrams: preview.proteinGrams,
      carbsGrams: preview.carbsGrams,
      fatGrams: preview.fatGrams,
      weeklyRateKg: preview.weeklyRateKg,
      effectiveFrom: new Date().toISOString().split('T')[0]!,
    });
    setPreview(null);
    setWeightKgInput('');
    Alert.alert(t('common.success'), t('editTargets.savedSuccess'));
  }, [preview, t]);

  const formatGoalLabel = useCallback(
    (g: string) => {
      switch (g) {
        case 'lose_fat':
          return t('editTargets.loseFat');
        case 'maintain':
          return t('editTargets.maintain');
        case 'gain':
          return t('editTargets.gain');
        default:
          return g;
      }
    },
    [t],
  );

  // ── Loading state ──
  if (loading) {
    return (
      <View className="flex-1 bg-surface-app">
        <SafeAreaView edges={['top']} className="flex-1">
          <View className="flex-row items-center px-5 py-3">
            <BackButton />
            <Text className="flex-1 text-lg leading-7 font-sans-bold text-text text-center mr-11">
              {t('editTargets.title')}
            </Text>
          </View>
          <View className="px-5 pt-6 gap-3">
            <SkeletonLoader height={120} borderRadius={16} />
            <SkeletonLoader height={180} borderRadius={16} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ── Error state ──
  if (loadError) {
    return (
      <View className="flex-1 bg-surface-app">
        <SafeAreaView edges={['top']} className="flex-1">
          <View className="flex-row items-center px-5 py-3">
            <BackButton />
            <Text className="flex-1 text-lg leading-7 font-sans-bold text-text text-center mr-11">
              {t('editTargets.title')}
            </Text>
          </View>
          <View className="flex-1 items-center justify-center px-6">
            <Ionicons name="alert-circle-outline" size={48} color={c.textSecondary} />
            <Text className="text-base font-sans-medium text-text-secondary mt-4 text-center">
              {t('editTargets.loadFailed')}
            </Text>
            <Button
              variant="primary"
              size="md"
              onPress={() => {
                setLoadError(false);
                setLoading(true);
                api
                  .get<{ data: CurrentTarget | null }>('/targets/current')
                  .then((res) => {
                    setCurrent(res.data);
                  })
                  .catch(() => setLoadError(true))
                  .finally(() => setLoading(false));
              }}
              className="mt-6"
              accessibilityLabel={t('common.retry')}
            >
              {t('common.retry')}
            </Button>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface-app">
      <SafeAreaView edges={['top']} className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-5 py-3">
          <BackButton />
          <Text className="flex-1 text-lg leading-7 font-sans-bold text-text text-center mr-11">
            {t('editTargets.title')}
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
            {/* ── Current targets card ── */}
            <Animated.View entering={FadeInDown.duration(400).springify()} className="mt-6 mb-4">
              <View className="bg-surface-card rounded-2xl p-4 border border-surface-border">
                <View className="flex-row items-center gap-2 mb-3">
                  <Ionicons name="trophy-outline" size={16} color={c.textSecondary} />
                  <Text className="text-sm font-sans-semibold text-text">
                    {t('editTargets.currentTargets')}
                  </Text>
                </View>

                {current ? (
                  <>
                    {/* Calorie hero */}
                    <View className="items-center bg-surface-secondary rounded-xl py-4 mb-3">
                      <Text
                        className="text-3xl font-sans-bold"
                        style={{ color: c.primary }}
                        accessibilityLabel={`${current.calorieTarget} ${t('editTargets.kcalDay')}`}
                      >
                        {current.calorieTarget.toLocaleString()}
                      </Text>
                      <Text className="text-xs text-text-tertiary font-sans-medium mt-1">
                        {t('editTargets.kcalDay')}
                      </Text>
                    </View>

                    {/* Macros */}
                    <View className="gap-0.5">
                      <MacroRow
                        label={t('editTargets.protein')}
                        value={current.proteinGrams}
                        unit={t('editTargets.grams')}
                      />
                      <View className="h-px bg-surface-secondary" />
                      <MacroRow
                        label={t('editTargets.carbs')}
                        value={current.carbsGrams}
                        unit={t('editTargets.grams')}
                      />
                      <View className="h-px bg-surface-secondary" />
                      <MacroRow
                        label={t('editTargets.fat')}
                        value={current.fatGrams}
                        unit={t('editTargets.grams')}
                      />
                      <View className="h-px bg-surface-secondary" />
                      <View className="flex-row items-center justify-between py-2">
                        <Text className="text-sm text-text-secondary font-sans-medium">
                          {t('editTargets.goal')}
                        </Text>
                        <Text className="text-sm font-sans-bold text-text">
                          {formatGoalLabel(current.goalType)}
                        </Text>
                      </View>
                      {current.weeklyRateKg > 0 && (
                        <>
                          <View className="h-px bg-surface-secondary" />
                          <View className="flex-row items-center justify-between py-2">
                            <Text className="text-sm text-text-secondary font-sans-medium">
                              {t('editTargets.weeklyRate')}
                            </Text>
                            <Text className="text-sm font-sans-bold text-text">
                              {current.weeklyRateKg} {t('editTargets.weeklyRateUnit')}
                            </Text>
                          </View>
                        </>
                      )}
                    </View>
                  </>
                ) : (
                  <View className="items-center py-4">
                    <Ionicons name="calculator-outline" size={36} color={c.textTertiary} />
                    <Text className="text-sm font-sans-medium text-text-secondary mt-2 text-center">
                      {t('editTargets.noCurrentTarget')}
                    </Text>
                    <Text className="text-xs text-text-tertiary mt-1 text-center">
                      {t('editTargets.noCurrentTargetDesc')}
                    </Text>
                  </View>
                )}
              </View>
            </Animated.View>

            {/* ── Recalculate form ── */}
            <Animated.View
              entering={FadeInDown.duration(400).delay(100).springify()}
              className="mb-4"
            >
              <View className="bg-surface-card rounded-2xl p-4 border border-surface-border">
                {/* Goal picker */}
                <Text className="text-sm font-sans-semibold text-text mb-2">
                  {t('editTargets.goal')}
                </Text>
                <View className="flex-row gap-2 mb-4">
                  {(['lose_fat', 'maintain', 'gain'] as const).map((g) => (
                    <GoalOption
                      key={g}
                      value={g}
                      label={formatGoalLabel(g)}
                      selected={goalType === g}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setGoalType(g);
                        setPreview(null);
                      }}
                    />
                  ))}
                </View>

                {/* Weekly rate — hidden for maintain */}
                {goalType !== 'maintain' && (
                  <View className="mb-4">
                    <Text className="text-sm font-sans-semibold text-text mb-1">
                      {t('editTargets.weeklyRate')}
                    </Text>
                    <Text className="text-xs text-text-tertiary mb-2">
                      {t('editTargets.weeklyRateDesc')}
                    </Text>
                    <RateStepPicker value={weeklyRateKg} onChange={setWeeklyRateKg} />
                  </View>
                )}

                {/* Current weight input */}
                <Input
                  label={t('editTargets.currentWeight')}
                  placeholder={t('editTargets.currentWeightPlaceholder')}
                  value={weightKgInput}
                  onChangeText={(v) => {
                    setWeightKgInput(v);
                    setPreview(null);
                  }}
                  keyboardType="decimal-pad"
                  containerClassName="mb-4"
                />

                <Button
                  variant="primary"
                  size="md"
                  onPress={handleRecalculate}
                  loading={calculating}
                  disabled={!weightKgInput.trim()}
                  accessibilityLabel={t('editTargets.recalculate')}
                >
                  {t('editTargets.recalculate')}
                </Button>
              </View>
            </Animated.View>

            {/* ── Preview card ── */}
            {preview && (
              <Animated.View entering={FadeInDown.duration(350).springify()} className="mb-4">
                <View
                  className="bg-surface-card rounded-2xl p-4 border"
                  style={{ borderColor: `${c.primary}55` }}
                >
                  <View className="flex-row items-center gap-2 mb-3">
                    <Ionicons name="sparkles-outline" size={16} color={c.primary} />
                    <Text className="text-sm font-sans-semibold text-text">
                      {t('editTargets.previewTitle')}
                    </Text>
                  </View>

                  {/* Calorie hero */}
                  <View
                    className="items-center rounded-xl py-4 mb-3"
                    style={{ backgroundColor: `${c.primary}1a` }}
                  >
                    <Text
                      className="text-3xl font-sans-bold"
                      style={{ color: c.primary }}
                      accessibilityLabel={`${preview.calorieTarget} ${t('editTargets.kcalDay')}`}
                    >
                      {preview.calorieTarget.toLocaleString()}
                    </Text>
                    <Text className="text-xs font-sans-medium mt-1" style={{ color: c.primary }}>
                      {t('editTargets.kcalDay')}
                    </Text>
                  </View>

                  {/* Macros */}
                  <View className="gap-0.5 mb-4">
                    <MacroRow
                      label={t('editTargets.protein')}
                      value={preview.proteinGrams}
                      unit={t('editTargets.grams')}
                    />
                    <View className="h-px bg-surface-secondary" />
                    <MacroRow
                      label={t('editTargets.carbs')}
                      value={preview.carbsGrams}
                      unit={t('editTargets.grams')}
                    />
                    <View className="h-px bg-surface-secondary" />
                    <MacroRow
                      label={t('editTargets.fat')}
                      value={preview.fatGrams}
                      unit={t('editTargets.grams')}
                    />
                  </View>

                  {/* Info note */}
                  <View
                    className="flex-row items-start rounded-xl p-3 mb-4"
                    style={{ backgroundColor: `${c.primary}0d` }}
                  >
                    <Ionicons
                      name="information-circle-outline"
                      size={16}
                      color={c.primary}
                      style={{ marginTop: 1 }}
                    />
                    <Text className="text-xs text-text-secondary ml-2 flex-1 leading-5">
                      {t('editTargets.effectiveFrom')}
                    </Text>
                  </View>

                  <Button
                    variant="primary"
                    size="md"
                    onPress={handleConfirmSave}
                    accessibilityLabel={t('editTargets.confirmSave')}
                  >
                    {t('editTargets.confirmSave')}
                  </Button>
                </View>
              </Animated.View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
