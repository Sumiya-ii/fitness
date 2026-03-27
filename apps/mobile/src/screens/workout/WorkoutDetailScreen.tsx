import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
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
import { BackButton, Button, SkeletonLoader } from '../../components/ui';
import { useWorkoutStore } from '../../stores/workout.store';
import { useLocale } from '../../i18n';
import type { MainStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

function formatDateFull(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
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
            <SkeletonLoader width="100%" height={120} borderRadius={16} />
            <SkeletonLoader width="100%" height={80} borderRadius={16} />
            <SkeletonLoader width="100%" height={60} borderRadius={16} />
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
                <Pressable
                  onPress={() => setEditing(true)}
                  className="h-9 w-9 rounded-full bg-surface-secondary items-center justify-center"
                  hitSlop={8}
                >
                  <Ionicons name="pencil" size={16} color="#a1a1aa" />
                </Pressable>
              )}
              <Pressable
                onPress={handleDelete}
                className="h-9 w-9 rounded-full bg-red-50 items-center justify-center"
                hitSlop={8}
              >
                <Ionicons name="trash-outline" size={16} color="#e11d48" />
              </Pressable>
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Type card */}
            <Animated.View entering={FadeInDown.duration(300)} className="mx-5 mt-3">
              <View className="bg-surface-card rounded-2xl p-5 border border-surface-border items-center">
                <Text className="text-4xl mb-2">{detail.icon ?? '🏋️'}</Text>
                <Text className="text-xl font-sans-bold text-text-DEFAULT">{label}</Text>
                <Text className="text-sm text-text-tertiary font-sans mt-1">
                  {formatDateFull(detail.loggedAt)} · {formatTime(detail.loggedAt)}
                </Text>
              </View>
            </Animated.View>

            {/* Stats grid */}
            <Animated.View entering={FadeInDown.delay(60).duration(300)} className="mx-5 mt-4">
              <View className="flex-row gap-3">
                <View className="flex-1 bg-surface-card rounded-2xl p-4 border border-surface-border items-center">
                  <Ionicons name="time-outline" size={22} color="#8b5cf6" />
                  {editing ? (
                    <TextInput
                      className="text-2xl font-sans-bold text-text-DEFAULT text-center mt-1"
                      value={editDuration}
                      onChangeText={(t) => setEditDuration(t.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad"
                      placeholder="—"
                      placeholderTextColor="#3a3a3c"
                    />
                  ) : (
                    <Text className="text-2xl font-sans-bold text-text-DEFAULT mt-1">
                      {detail.durationMin ?? '—'}
                    </Text>
                  )}
                  <Text className="text-xs text-text-tertiary font-sans mt-0.5">
                    {t('workout.minutes')}
                  </Text>
                </View>

                <View className="flex-1 bg-surface-card rounded-2xl p-4 border border-surface-border items-center">
                  <Ionicons name="flame-outline" size={22} color="#f97316" />
                  <Text className="text-2xl font-sans-bold text-text-DEFAULT mt-1">
                    {detail.calorieBurned ?? '—'}
                  </Text>
                  <Text className="text-xs text-text-tertiary font-sans mt-0.5">kcal</Text>
                </View>
              </View>
            </Animated.View>

            {/* Note */}
            <Animated.View entering={FadeInDown.delay(120).duration(300)} className="mx-5 mt-4">
              <Text className="text-sm font-sans-medium text-text-secondary mb-2">
                {t('workout.note')}
              </Text>
              {editing ? (
                <View className="bg-surface-card rounded-2xl border border-surface-border">
                  <TextInput
                    className="px-4 py-3 text-base font-sans text-text-DEFAULT min-h-[80px]"
                    value={editNote}
                    onChangeText={setEditNote}
                    multiline
                    textAlignVertical="top"
                    maxLength={500}
                    placeholder={t('workout.notePlaceholder')}
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              ) : (
                <View className="bg-surface-card rounded-2xl p-4 border border-surface-border">
                  <Text className="text-base font-sans text-text-DEFAULT">
                    {detail.note || t('workout.noNote')}
                  </Text>
                </View>
              )}
            </Animated.View>
          </ScrollView>

          {/* Bottom action (when editing) */}
          {editing && (
            <View className="px-5 pb-4 pt-2 border-t border-surface-border bg-surface-app flex-row gap-3">
              <View className="flex-1">
                <Button
                  onPress={() => {
                    setEditing(false);
                    setEditDuration(detail.durationMin != null ? String(detail.durationMin) : '');
                    setEditNote(detail.note ?? '');
                  }}
                  variant="secondary"
                  size="lg"
                >
                  {t('common.cancel')}
                </Button>
              </View>
              <View className="flex-1">
                <Button onPress={handleSave} disabled={saving} variant="primary" size="lg">
                  {saving ? t('common.loading') : t('common.save')}
                </Button>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
