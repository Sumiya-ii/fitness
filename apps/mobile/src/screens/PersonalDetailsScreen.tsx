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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BackButton, Button, SkeletonLoader } from '../components/ui';
import { api } from '../api';
import { useLocale } from '../i18n';
import { useColors } from '../theme';

const STEP_GOAL_KEY = 'daily_step_goal';

interface ProfileData {
  displayName: string | null;
  gender: string | null;
  birthDate: string | null;
  heightCm: number | null;
  weightKg: number | null;
  goalWeightKg: number | null;
}

/* -- Format helpers -- */

function formatWeight(kg: number | null): string {
  if (kg === null) return '--';
  return `${kg} kg`;
}

function formatHeight(cm: number | null): string {
  if (cm === null) return '--';
  return `${cm} cm`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  return dateStr.replace(/-/g, '.');
}

function formatGender(gender: string | null, t: (k: string) => string): string {
  if (!gender) return '--';
  if (gender === 'male') return t('personalDetails.male');
  if (gender === 'female') return t('personalDetails.female');
  return gender;
}

/* -- Detail row -- */

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
      <View className="flex-row items-center py-3.5 min-h-[48px]">
        <Text className="flex-1 text-base leading-6 font-sans" style={{ color: c.text }}>
          {label}
        </Text>
        <Text className="text-base leading-6 font-sans-semibold mr-3" style={{ color: c.text }}>
          {value}
        </Text>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onEdit();
          }}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={`${label} ${value}`}
          className="h-9 w-9 rounded-xl items-center justify-center"
          style={{ backgroundColor: c.cardAlt }}
        >
          <Ionicons name="pencil-outline" size={16} color={c.textTertiary} />
        </Pressable>
      </View>
      {!isLast ? <View className="h-px bg-surface-secondary" /> : null}
    </>
  );
}

type EditField = 'weight' | 'goalWeight' | 'height' | 'birthDate' | 'gender' | 'stepGoal' | null;

/* -- Main screen -- */

export function PersonalDetailsScreen() {
  const c = useColors();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [stepGoal, setStepGoal] = useState<number>(10000);
  const [loading, setLoading] = useState(true);
  const [editField, setEditField] = useState<EditField>(null);
  const [saving, setSaving] = useState(false);

  const [editValue, setEditValue] = useState('');

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
        setEditValue(profile?.weightKg ? String(profile.weightKg) : '');
        break;
      case 'goalWeight':
        setEditValue(profile?.goalWeightKg ? String(profile.goalWeightKg) : '');
        break;
      case 'height':
        setEditValue(profile?.heightCm ? String(profile.heightCm) : '');
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
        saveProfileField({ weightKg: num });
        break;
      case 'goalWeight':
        if (isNaN(num) || num <= 0) return;
        saveProfileField({ goalWeightKg: num });
        break;
      case 'height':
        if (isNaN(num) || num <= 0) return;
        saveProfileField({ heightCm: num });
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

  const getEditorLabel = (): string => {
    switch (editField) {
      case 'weight':
        return t('personalDetails.currentWeight');
      case 'goalWeight':
        return t('personalDetails.goalWeight');
      case 'height':
        return t('personalDetails.height');
      case 'birthDate':
        return t('personalDetails.dateOfBirth');
      case 'stepGoal':
        return t('personalDetails.dailyStepGoal');
      default:
        return '';
    }
  };

  const getUnitLabel = (): string => {
    switch (editField) {
      case 'stepGoal':
        return t('personalDetails.steps');
      case 'height':
        return 'cm';
      default:
        return 'kg';
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-surface-app">
        <SafeAreaView edges={['top']} className="flex-1">
          <View className="flex-row items-center px-5 py-3">
            <BackButton />
            <Text className="flex-1 text-lg leading-7 font-sans-bold text-text text-center mr-11">
              {t('personalDetails.title')}
            </Text>
          </View>
          <View className="px-5 pt-6 gap-3">
            <SkeletonLoader height={80} borderRadius={16} />
            <SkeletonLoader height={280} borderRadius={16} />
          </View>
        </SafeAreaView>
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
        <View className="flex-row items-center px-5 py-3">
          <BackButton />
          <Text className="flex-1 text-lg leading-7 font-sans-bold text-text text-center mr-11">
            {t('personalDetails.title')}
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
            {/* -- Goal Weight card -- */}
            <Animated.View entering={FadeInDown.duration(400).springify()}>
              <View className="bg-surface-card rounded-2xl px-5 py-4 mt-6 mb-4 border border-surface-border flex-row items-center">
                <View className="flex-1">
                  <Text
                    className="text-sm leading-5 font-sans-medium"
                    style={{ color: c.textSecondary }}
                  >
                    {t('personalDetails.goalWeight')}
                  </Text>
                  <Text className="text-xl leading-7 font-sans-bold text-text mt-1">
                    {formatWeight(profile?.goalWeightKg ?? null)}
                  </Text>
                </View>
                <Button
                  variant="primary"
                  size="sm"
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    startEdit('goalWeight');
                  }}
                  accessibilityLabel={t('personalDetails.changeGoal')}
                >
                  {t('personalDetails.changeGoal')}
                </Button>
              </View>
            </Animated.View>

            {/* -- Details card -- */}
            <Animated.View entering={FadeInDown.duration(400).delay(100).springify()}>
              <View className="bg-surface-card rounded-2xl px-4 border border-surface-border">
                <DetailRow
                  label={t('personalDetails.currentWeight')}
                  value={formatWeight(profile?.weightKg ?? null)}
                  onEdit={() => startEdit('weight')}
                />
                <DetailRow
                  label={t('personalDetails.height')}
                  value={formatHeight(profile?.heightCm ?? null)}
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
                  value={`${stepGoal.toLocaleString()} ${t('personalDetails.steps')}`}
                  onEdit={() => startEdit('stepGoal')}
                  isLast
                />
              </View>
            </Animated.View>

            {/* -- Inline editor -- */}
            {showInlineEditor ? (
              <Animated.View entering={FadeInDown.duration(300).springify()}>
                <View className="bg-surface-card rounded-2xl px-4 py-4 mt-4 border border-surface-border">
                  <Text
                    className="text-sm leading-5 font-sans-semibold mb-3"
                    style={{ color: c.textTertiary }}
                  >
                    {getEditorLabel()}
                  </Text>

                  <View className="flex-row items-center">
                    <TextInput
                      className="flex-1 text-base leading-6 font-sans-medium text-text bg-surface-secondary rounded-xl px-4 py-3"
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
                      accessibilityLabel={getEditorLabel()}
                    />
                    {editField !== 'birthDate' ? (
                      <Text className="font-sans-medium ml-3" style={{ color: c.textTertiary }}>
                        {getUnitLabel()}
                      </Text>
                    ) : null}
                  </View>

                  <View className="flex-row gap-3 mt-4">
                    <View className="flex-1">
                      <Button
                        variant="secondary"
                        size="md"
                        onPress={cancelEdit}
                        accessibilityLabel={t('common.cancel')}
                      >
                        {t('common.cancel')}
                      </Button>
                    </View>
                    <View className="flex-1">
                      <Button
                        variant="primary"
                        size="md"
                        onPress={handleSaveEdit}
                        loading={saving}
                        accessibilityLabel={t('common.save')}
                      >
                        {t('common.save')}
                      </Button>
                    </View>
                  </View>
                </View>
              </Animated.View>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
