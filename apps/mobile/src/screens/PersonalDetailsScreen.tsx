import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BackButton } from '../components/ui';
import { useSettingsStore } from '../stores/settings.store';
import { api } from '../api';
import { useLocale } from '../i18n';
import { useColors } from '../theme';

const STEP_GOAL_KEY = 'daily_step_goal';

interface ProfileData {
  displayName: string | null;
  unitSystem: string;
  gender: string | null;
  birthDate: string | null;
  heightCm: number | null;
  weightKg: number | null;
  goalWeightKg: number | null;
}

/* ── Unit conversion helpers ── */

function kgToLbs(kg: number): number {
  return Math.round(kg * 2.20462 * 10) / 10;
}

function lbsToKg(lbs: number): number {
  return Math.round((lbs / 2.20462) * 10) / 10;
}

function cmToFtIn(cm: number): { ft: number; inches: number } {
  const totalInches = cm / 2.54;
  const ft = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return { ft, inches };
}

function ftInToCm(ft: number, inches: number): number {
  return Math.round((ft * 12 + inches) * 2.54 * 10) / 10;
}

function formatWeight(kg: number | null, imperial: boolean): string {
  if (kg === null) return '—';
  if (imperial) return `${kgToLbs(kg)} lbs`;
  return `${kg} kg`;
}

function formatHeight(cm: number | null, imperial: boolean): string {
  if (cm === null) return '—';
  if (imperial) {
    const { ft, inches } = cmToFtIn(cm);
    return `${ft} ft ${inches} in`;
  }
  return `${cm} cm`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return dateStr.replace(/-/g, '.');
}

function formatGender(gender: string | null, t: (k: string) => string): string {
  if (!gender) return '—';
  if (gender === 'male') return t('personalDetails.male');
  if (gender === 'female') return t('personalDetails.female');
  return gender;
}

/* ── Detail row ── */

function DetailRow({
  label,
  value,
  onEdit,
  isLast,
}: {
  label: string;
  value: string;
  onEdit: () => void;
  isLast?: boolean;
}) {
  const c = useColors();
  return (
    <>
      <View className="flex-row items-center py-[16px] px-1">
        <Text className="flex-1 text-[15px] font-sans text-text">{label}</Text>
        <Text className="text-[15px] font-sans-semibold text-text mr-3">{value}</Text>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onEdit();
          }}
          hitSlop={12}
        >
          <Ionicons name="pencil-outline" size={18} color={c.textTertiary} />
        </Pressable>
      </View>
      {!isLast && <View className="h-px bg-surface-secondary mx-1" />}
    </>
  );
}

type EditField = 'weight' | 'goalWeight' | 'height' | 'birthDate' | 'gender' | 'stepGoal' | null;

/* ── Main screen ── */

export function PersonalDetailsScreen() {
  const c = useColors();
  const { t } = useLocale();
  const unitSystem = useSettingsStore((s) => s.unitSystem);
  const imperial = unitSystem === 'imperial';

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [stepGoal, setStepGoal] = useState<number>(10000);
  const [loading, setLoading] = useState(true);
  const [editField, setEditField] = useState<EditField>(null);
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editValue, setEditValue] = useState('');
  const [editValue2, setEditValue2] = useState(''); // for ft/in second field

  useEffect(() => {
    AsyncStorage.getItem(STEP_GOAL_KEY).then((v) => {
      if (v) setStepGoal(parseInt(v, 10) || 10000);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      api
        .get<{ data: ProfileData }>('/profile')
        .then((res) => {
          setProfile(res.data);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, []),
  );

  const startEdit = (field: EditField) => {
    if (!profile && field !== 'stepGoal') return;
    setEditField(field);

    switch (field) {
      case 'weight':
        if (imperial && profile?.weightKg) {
          setEditValue(String(kgToLbs(profile.weightKg)));
        } else {
          setEditValue(profile?.weightKg ? String(profile.weightKg) : '');
        }
        break;
      case 'goalWeight':
        if (imperial && profile?.goalWeightKg) {
          setEditValue(String(kgToLbs(profile.goalWeightKg)));
        } else {
          setEditValue(profile?.goalWeightKg ? String(profile.goalWeightKg) : '');
        }
        break;
      case 'height':
        if (imperial && profile?.heightCm) {
          const { ft, inches } = cmToFtIn(profile.heightCm);
          setEditValue(String(ft));
          setEditValue2(String(inches));
        } else {
          setEditValue(profile?.heightCm ? String(profile.heightCm) : '');
        }
        break;
      case 'birthDate':
        setEditValue(profile?.birthDate ? profile.birthDate.replace(/-/g, '.') : '');
        break;
      case 'gender':
        // Cycle through: male -> female -> male
        {
          const newGender = profile?.gender === 'male' ? 'female' : 'male';
          saveProfileField({ gender: newGender });
          setEditField(null);
        }
        break;
      case 'stepGoal':
        setEditValue(String(stepGoal));
        break;
    }
  };

  const saveProfileField = async (data: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await api.put<{ data: ProfileData }>('/profile', data);
      setProfile(res.data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert(t('common.error'), t('settings.saveFailed'));
    } finally {
      setSaving(false);
      setEditField(null);
    }
  };

  const handleSaveEdit = async () => {
    const num = parseFloat(editValue);
    switch (editField) {
      case 'weight':
        if (isNaN(num) || num <= 0) return;
        saveProfileField({ weightKg: imperial ? lbsToKg(num) : num });
        break;
      case 'goalWeight':
        if (isNaN(num) || num <= 0) return;
        saveProfileField({ goalWeightKg: imperial ? lbsToKg(num) : num });
        break;
      case 'height':
        if (imperial) {
          const ft = parseInt(editValue, 10);
          const inches = parseInt(editValue2, 10) || 0;
          if (isNaN(ft) || ft <= 0) return;
          saveProfileField({ heightCm: ftInToCm(ft, inches) });
        } else {
          if (isNaN(num) || num <= 0) return;
          saveProfileField({ heightCm: num });
        }
        break;
      case 'birthDate': {
        // Accept YYYY.MM.DD or YYYY-MM-DD
        const cleaned = editValue.replace(/\./g, '-');
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(cleaned)) return;
        const parsed = new Date(cleaned);
        if (isNaN(parsed.getTime())) return;
        saveProfileField({ birthDate: cleaned });
        break;
      }
      case 'stepGoal': {
        const steps = parseInt(editValue, 10);
        if (isNaN(steps) || steps <= 0) return;
        setStepGoal(steps);
        await AsyncStorage.setItem(STEP_GOAL_KEY, String(steps));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setEditField(null);
        setSaving(false);
        break;
      }
    }
  };

  const cancelEdit = () => {
    setEditField(null);
  };

  if (loading) {
    return (
      <View className="flex-1 bg-surface-app items-center justify-center">
        <Text className="text-text-tertiary font-sans-medium">{t('common.loading')}</Text>
      </View>
    );
  }

  const showInlineEditor =
    editField === 'weight' ||
    editField === 'goalWeight' ||
    editField === 'height' ||
    editField === 'stepGoal' ||
    editField === 'birthDate';

  return (
    <View className="flex-1 bg-surface-app">
      <SafeAreaView edges={['top']} className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-4 py-3">
          <BackButton />
          <Text className="flex-1 text-lg font-sans-bold text-text text-center mr-10">
            {t('personalDetails.title')}
          </Text>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1"
        >
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Goal Weight card ── */}
            <View className="bg-surface-card rounded-2xl px-5 py-4 mt-6 mb-3 border border-surface-border flex-row items-center">
              <View className="flex-1">
                <Text className="text-[15px] font-sans text-text">
                  {t('personalDetails.goalWeight')}
                </Text>
                <Text className="text-[17px] font-sans-bold text-text mt-1">
                  {formatWeight(profile?.goalWeightKg ?? null, imperial)}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  startEdit('goalWeight');
                }}
                className="bg-text rounded-full px-4 py-2"
              >
                <Text className="text-[13px] font-sans-semibold text-surface-app">
                  {t('personalDetails.changeGoal')}
                </Text>
              </Pressable>
            </View>

            {/* ── Details card ── */}
            <View className="bg-surface-card rounded-2xl px-4 border border-surface-border">
              <DetailRow
                label={t('personalDetails.currentWeight')}
                value={formatWeight(profile?.weightKg ?? null, imperial)}
                onEdit={() => startEdit('weight')}
              />
              <DetailRow
                label={t('personalDetails.height')}
                value={formatHeight(profile?.heightCm ?? null, imperial)}
                onEdit={() => startEdit('height')}
              />
              <DetailRow
                label={t('personalDetails.dateOfBirth')}
                value={formatDate(profile?.birthDate ?? null)}
                onEdit={() => startEdit('birthDate')}
              />
              <DetailRow
                label={t('personalDetails.gender')}
                value={formatGender(profile?.gender ?? null, t)}
                onEdit={() => startEdit('gender')}
              />
              <DetailRow
                label={t('personalDetails.dailyStepGoal')}
                value={`${stepGoal} ${t('personalDetails.steps')}`}
                onEdit={() => startEdit('stepGoal')}
                isLast
              />
            </View>

            {/* ── Inline editor ── */}
            {showInlineEditor && (
              <View className="bg-surface-card rounded-2xl px-4 py-4 mt-3 border border-surface-border">
                <Text className="text-[13px] font-sans-semibold text-text-tertiary mb-3">
                  {editField === 'weight'
                    ? t('personalDetails.currentWeight')
                    : editField === 'goalWeight'
                      ? t('personalDetails.goalWeight')
                      : editField === 'height'
                        ? t('personalDetails.height')
                        : editField === 'birthDate'
                          ? t('personalDetails.dateOfBirth')
                          : t('personalDetails.dailyStepGoal')}
                </Text>

                {editField === 'height' && imperial ? (
                  <View className="flex-row items-center gap-3">
                    <View className="flex-1 flex-row items-center">
                      <TextInput
                        className="flex-1 text-text font-sans-medium text-[16px] bg-surface-secondary rounded-xl px-4 py-3"
                        value={editValue}
                        onChangeText={setEditValue}
                        keyboardType="number-pad"
                        autoFocus
                        placeholder="ft"
                        placeholderTextColor={c.textTertiary}
                      />
                      <Text className="text-text-tertiary font-sans-medium ml-2">ft</Text>
                    </View>
                    <View className="flex-1 flex-row items-center">
                      <TextInput
                        className="flex-1 text-text font-sans-medium text-[16px] bg-surface-secondary rounded-xl px-4 py-3"
                        value={editValue2}
                        onChangeText={setEditValue2}
                        keyboardType="number-pad"
                        placeholder="in"
                        placeholderTextColor={c.textTertiary}
                      />
                      <Text className="text-text-tertiary font-sans-medium ml-2">in</Text>
                    </View>
                  </View>
                ) : (
                  <View className="flex-row items-center">
                    <TextInput
                      className="flex-1 text-text font-sans-medium text-[16px] bg-surface-secondary rounded-xl px-4 py-3"
                      value={editValue}
                      onChangeText={setEditValue}
                      keyboardType={
                        editField === 'stepGoal'
                          ? 'number-pad'
                          : editField === 'birthDate'
                            ? 'numbers-and-punctuation'
                            : 'decimal-pad'
                      }
                      autoFocus
                      placeholder={editField === 'birthDate' ? 'YYYY.MM.DD' : undefined}
                      placeholderTextColor={c.textTertiary}
                    />
                    {editField !== 'birthDate' && (
                      <Text className="text-text-tertiary font-sans-medium ml-3">
                        {editField === 'stepGoal'
                          ? t('personalDetails.steps')
                          : editField === 'height'
                            ? 'cm'
                            : imperial
                              ? 'lbs'
                              : 'kg'}
                      </Text>
                    )}
                  </View>
                )}

                <View className="flex-row gap-3 mt-4">
                  <Pressable
                    onPress={cancelEdit}
                    className="flex-1 bg-surface-secondary rounded-xl py-3 items-center"
                  >
                    <Text className="text-text font-sans-semibold text-[14px]">
                      {t('common.cancel')}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleSaveEdit}
                    disabled={saving}
                    className="flex-1 bg-text rounded-xl py-3 items-center"
                  >
                    <Text className="text-surface-app font-sans-semibold text-[14px]">
                      {saving ? t('common.loading') : t('common.save')}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
