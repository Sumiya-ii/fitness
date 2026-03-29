import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { BackButton, Button, IconButton, SkeletonLoader } from '../../components/ui';
import { useWorkoutStore } from '../../stores/workout.store';
import { useLocale } from '../../i18n';
import { useColors } from '../../theme';
import type { MainStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

function formatDateFull(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === 'mn' ? 'mn-MN' : 'en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function WorkoutDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<MainStackParamList, 'WorkoutDetail'>>();
  const id = (route.params as { id: string }).id;
  const { t, locale } = useLocale();
  const c = useColors();
  const { detail, detailLoading, fetchDetail, updateWorkout, deleteWorkout, saving } =
    useWorkoutStore();

  const [editing, setEditing] = useState(false);
  const [editDuration, setEditDuration] = useState('');
  const [editNote, setEditNote] = useState('');

  useFocusEffect(
    useCallback(() => {
      fetchDetail(id);
    }, [id, fetchDetail]),
  );

  useEffect(() => {
    if (detail) {
      setEditDuration(detail.durationMin != null ? String(detail.durationMin) : '');
      setEditNote(detail.note ?? '');
    }
  }, [detail]);

  const label = detail?.label
    ? locale === 'mn'
      ? detail.label.mn
      : detail.label.en
    : (detail?.workoutType.replace(/_/g, ' ') ?? '');

  const handleSave = async () => {
    if (!detail) return;
    const dur = editDuration ? parseInt(editDuration, 10) : null;
    const success = await updateWorkout(detail.id, {
      durationMin: dur,
      note: editNote.trim() || null,
    });
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditing(false);
      fetchDetail(id);
    }
  };

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(t('workout.deleteTitle'), t('workout.deleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          const success = await deleteWorkout(id);
          if (success) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            navigation.goBack();
          }
        },
      },
    ]);
  };

  // Loading state
  if (detailLoading || !detail) {
    return (
      <View className="flex-1 bg-surface-app">
        <SafeAreaView edges={['top']} className="flex-1">
          <View className="flex-row items-center px-5 pt-3 pb-2">
            <BackButton />
            <Text className="ml-3 text-xl font-sans-bold text-text-DEFAULT">
              {t('workout.details')}
            </Text>
          </View>
          <View className="mx-5 mt-4 gap-4">
            <SkeletonLoader width="100%" height={140} borderRadius={24} />
            <View className="flex-row gap-3">
              <View className="flex-1">
                <SkeletonLoader width="100%" height={100} borderRadius={16} />
              </View>
              <View className="flex-1">
                <SkeletonLoader width="100%" height={100} borderRadius={16} />
              </View>
            </View>
            <SkeletonLoader width="100%" height={80} borderRadius={16} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface-app">
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1"
        >
          {/* Header */}
          <View className="flex-row items-center justify-between px-5 pt-3 pb-2">
            <View className="flex-row items-center">
              <BackButton />
              <Text className="ml-3 text-xl font-sans-bold text-text-DEFAULT">
                {t('workout.details')}
              </Text>
            </View>
            <View className="flex-row gap-2">
              {!editing && (
                <IconButton
                  icon="pencil"
                  variant="surface"
                  iconColor={c.textSecondary}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setEditing(true);
                  }}
                  accessibilityLabel={t('common.edit')}
                />
              )}
              <IconButton
                icon="trash-outline"
                variant="surface"
                iconColor={c.danger}
                onPress={handleDelete}
                accessibilityLabel={t('common.delete')}
              />
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Type card */}
            <Animated.View entering={FadeInDown.duration(300)} className="mx-5 mt-3">
              <View className="bg-surface-default rounded-3xl p-6 border border-surface-border items-center">
                <Text className="text-4xl mb-3">{detail.icon ?? '🏋️'}</Text>
                <Text className="text-xl font-sans-bold text-text-DEFAULT leading-7">{label}</Text>
                <Text className="text-sm text-text-tertiary font-sans mt-1.5 leading-5 text-center">
                  {formatDateFull(detail.loggedAt, locale)}
                </Text>
                <Text className="text-xs text-text-tertiary font-sans mt-0.5 leading-4">
                  {formatTime(detail.loggedAt)}
                </Text>
              </View>
            </Animated.View>

            {/* Stats grid */}
            <Animated.View entering={FadeInDown.delay(60).duration(300)} className="mx-5 mt-4">
              <View className="flex-row gap-3">
                {/* Duration */}
                <View className="flex-1 bg-surface-default rounded-2xl p-4 border border-surface-border items-center">
                  <View className="h-9 w-9 rounded-full bg-surface-secondary items-center justify-center mb-2">
                    <Ionicons name="time-outline" size={20} color={c.success} />
                  </View>
                  {editing ? (
                    <TextInput
                      className="text-2xl font-sans-bold text-text-DEFAULT text-center mt-1"
                      value={editDuration}
                      onChangeText={(val) => setEditDuration(val.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad"
                      placeholder="--"
                      placeholderTextColor={c.textTertiary}
                      accessibilityLabel={t('workout.minutes')}
                    />
                  ) : (
                    <Text className="text-2xl font-sans-bold text-text-DEFAULT mt-1 leading-8">
                      {detail.durationMin ?? '--'}
                    </Text>
                  )}
                  <Text className="text-xs text-text-tertiary font-sans mt-1 leading-4">
                    {t('workout.minutes')}
                  </Text>
                </View>

                {/* Calories */}
                <View className="flex-1 bg-surface-default rounded-2xl p-4 border border-surface-border items-center">
                  <View className="h-9 w-9 rounded-full bg-surface-secondary items-center justify-center mb-2">
                    <Ionicons name="flame-outline" size={20} color={c.warning} />
                  </View>
                  <Text className="text-2xl font-sans-bold text-text-DEFAULT mt-1 leading-8">
                    {detail.calorieBurned ?? '--'}
                  </Text>
                  <Text className="text-xs text-text-tertiary font-sans mt-1 leading-4">kcal</Text>
                </View>
              </View>
            </Animated.View>

            {/* Note */}
            <Animated.View entering={FadeInDown.delay(120).duration(300)} className="mx-5 mt-4">
              <Text className="text-sm font-sans-medium text-text-secondary mb-2 leading-5">
                {t('workout.note')}
              </Text>
              {editing ? (
                <View className="bg-surface-default rounded-2xl border border-surface-border">
                  <TextInput
                    className="px-4 py-3 text-base font-sans text-text-DEFAULT min-h-[80px]"
                    value={editNote}
                    onChangeText={setEditNote}
                    multiline
                    textAlignVertical="top"
                    maxLength={500}
                    placeholder={t('workout.notePlaceholder')}
                    placeholderTextColor={c.textTertiary}
                    accessibilityLabel={t('workout.note')}
                  />
                </View>
              ) : (
                <View className="bg-surface-default rounded-2xl p-4 border border-surface-border">
                  <Text className="text-base font-sans text-text-DEFAULT leading-6">
                    {detail.note || t('workout.noNote')}
                  </Text>
                </View>
              )}
            </Animated.View>
          </ScrollView>

          {/* Bottom action (when editing) */}
          {editing && (
            <Animated.View
              entering={FadeInDown.duration(200)}
              className="px-5 pb-4 pt-3 border-t border-surface-border bg-surface-app flex-row gap-3"
            >
              <View className="flex-1">
                <Button
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setEditing(false);
                    setEditDuration(detail.durationMin != null ? String(detail.durationMin) : '');
                    setEditNote(detail.note ?? '');
                  }}
                  variant="secondary"
                  size="lg"
                  accessibilityLabel={t('common.cancel')}
                >
                  {t('common.cancel')}
                </Button>
              </View>
              <View className="flex-1">
                <Button
                  onPress={handleSave}
                  disabled={saving}
                  loading={saving}
                  variant="primary"
                  size="lg"
                  accessibilityLabel={t('common.save')}
                >
                  {t('common.save')}
                </Button>
              </View>
            </Animated.View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
