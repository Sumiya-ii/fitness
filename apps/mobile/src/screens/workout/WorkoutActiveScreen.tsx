import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Button } from '../../components/ui';
import { useWorkoutStore } from '../../stores/workout.store';
import { useLocale } from '../../i18n';
import type { MainStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function WorkoutActiveScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<MainStackParamList, 'WorkoutActive'>>();
  const workoutType = (route.params as { workoutType?: string } | undefined)?.workoutType ?? '';
  const { t, locale } = useLocale();
  const {
    catalogFlat,
    fetchCatalog,
    estimate,
    estimateLoading,
    fetchEstimate,
    createWorkout,
    saving,
    startTimer,
    stopTimer,
    activeStartTime,
    activeWorkoutType,
  } = useWorkoutStore();

  // ─── Local state ─────────────────────────────────────────────────────────────
  const [manualDuration, setManualDuration] = useState('');
  const [note, setNote] = useState('');
  const [timerMode, setTimerMode] = useState(true); // true = use timer, false = manual input
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Workout type info ───────────────────────────────────────────────────────
  const typeInfo = useMemo(
    () => catalogFlat.find((t) => t.key === workoutType),
    [catalogFlat, workoutType],
  );

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  // Auto-start timer on mount if no active timer
  useEffect(() => {
    if (activeStartTime && activeWorkoutType === workoutType) {
      // Resume existing timer
      const elapsed = Math.floor((Date.now() - activeStartTime) / 1000);
      setTimerSeconds(elapsed);
      setTimerRunning(true);
    } else if (!activeStartTime && workoutType) {
      // Start new timer
      startTimer(workoutType);
      setTimerRunning(true);
    }
  }, []);

  // Timer tick
  useEffect(() => {
    if (timerRunning) {
      intervalRef.current = setInterval(() => {
        const { activeStartTime: start } = useWorkoutStore.getState();
        if (start) {
          setTimerSeconds(Math.floor((Date.now() - start) / 1000));
        } else {
          setTimerSeconds((s) => s + 1);
        }
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timerRunning]);

  // Fetch calorie estimate as duration changes
  const currentDuration = timerMode
    ? Math.max(Math.ceil(timerSeconds / 60), 1)
    : parseInt(manualDuration, 10) || 0;

  useEffect(() => {
    if (workoutType && currentDuration > 0) {
      const timeout = setTimeout(() => {
        fetchEstimate(workoutType, currentDuration);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [workoutType, currentDuration, fetchEstimate]);

  const label = typeInfo?.label
    ? locale === 'mn'
      ? typeInfo.label.mn
      : typeInfo.label.en
    : workoutType.replace(/_/g, ' ');

  // ─── Actions ─────────────────────────────────────────────────────────────────

  const toggleTimer = () => {
    if (timerRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setTimerRunning(false);
    } else {
      setTimerRunning(true);
    }
  };

  const handleDiscard = () => {
    Alert.alert(t('workout.discardTitle'), t('workout.discardMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.discard'),
        style: 'destructive',
        onPress: () => {
          stopTimer();
          navigation.goBack();
        },
      },
    ]);
  };

  const handleFinish = async () => {
    const duration = timerMode
      ? Math.max(Math.ceil(timerSeconds / 60), 1)
      : parseInt(manualDuration, 10);

    if (!timerMode && (!duration || duration <= 0)) {
      Alert.alert(t('workout.enterDuration'));
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    stopTimer();

    const result = await createWorkout({
      workoutType,
      durationMin: duration || undefined,
      note: note.trim() || undefined,
    });

    if (result) {
      navigation.goBack();
      navigation.goBack(); // Go back past type picker too
    }
  };

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
              <Pressable onPress={handleDiscard} hitSlop={8}>
                <Ionicons name="close" size={24} color="#0f172a" />
              </Pressable>
              <Text className="ml-3 text-xl font-sans-bold text-text-DEFAULT" numberOfLines={1}>
                {label}
              </Text>
            </View>
            {typeInfo && <Text className="text-2xl">{typeInfo.icon}</Text>}
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Timer / Duration Section */}
            <Animated.View entering={FadeInDown.duration(300)} className="mx-5 mt-4">
              {/* Mode toggle */}
              <View className="flex-row bg-surface-secondary rounded-xl p-1 mb-5">
                <Pressable
                  onPress={() => setTimerMode(true)}
                  className={`flex-1 py-2.5 rounded-lg items-center ${timerMode ? 'bg-white' : ''}`}
                  style={
                    timerMode
                      ? { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 }
                      : undefined
                  }
                >
                  <Text
                    className={`text-sm font-sans-medium ${timerMode ? 'text-text-DEFAULT' : 'text-text-tertiary'}`}
                  >
                    {t('workout.timer')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setTimerMode(false);
                    setTimerRunning(false);
                    if (intervalRef.current) clearInterval(intervalRef.current);
                  }}
                  className={`flex-1 py-2.5 rounded-lg items-center ${!timerMode ? 'bg-white' : ''}`}
                  style={
                    !timerMode
                      ? { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 }
                      : undefined
                  }
                >
                  <Text
                    className={`text-sm font-sans-medium ${!timerMode ? 'text-text-DEFAULT' : 'text-text-tertiary'}`}
                  >
                    {t('workout.manual')}
                  </Text>
                </Pressable>
              </View>

              {timerMode ? (
                /* Live timer */
                <View className="items-center mb-6">
                  <View
                    className="bg-white rounded-3xl px-10 py-8 items-center border border-surface-border"
                    style={{
                      shadowColor: '#0b1220',
                      shadowOpacity: 0.06,
                      shadowRadius: 12,
                      elevation: 2,
                    }}
                  >
                    <Text className="text-5xl font-sans-bold text-text-DEFAULT tracking-wider">
                      {formatTimer(timerSeconds)}
                    </Text>
                    <Text className="text-sm text-text-tertiary font-sans mt-2">
                      {t('workout.elapsed')}
                    </Text>
                  </View>

                  {/* Pause / Resume */}
                  <Pressable
                    onPress={toggleTimer}
                    className={`mt-5 h-14 w-14 rounded-full items-center justify-center ${timerRunning ? 'bg-orange-500' : 'bg-primary-500'}`}
                  >
                    <Ionicons name={timerRunning ? 'pause' : 'play'} size={24} color="#ffffff" />
                  </Pressable>
                  <Text className="text-xs text-text-tertiary font-sans mt-2">
                    {timerRunning ? t('workout.tapPause') : t('workout.tapResume')}
                  </Text>
                </View>
              ) : (
                /* Manual duration input */
                <View className="items-center mb-6">
                  <View className="bg-white rounded-2xl px-6 py-5 border border-surface-border w-full">
                    <Text className="text-sm font-sans-medium text-text-secondary mb-2">
                      {t('workout.duration')}
                    </Text>
                    <View className="flex-row items-center">
                      <TextInput
                        className="flex-1 text-4xl font-sans-bold text-text-DEFAULT text-center"
                        placeholder="30"
                        placeholderTextColor="#c3cedf"
                        value={manualDuration}
                        onChangeText={(t) => setManualDuration(t.replace(/[^0-9]/g, ''))}
                        keyboardType="number-pad"
                        maxLength={4}
                      />
                      <Text className="text-lg font-sans-medium text-text-tertiary ml-2">min</Text>
                    </View>
                  </View>
                </View>
              )}
            </Animated.View>

            {/* Calorie Estimate Preview */}
            <Animated.View entering={FadeInDown.delay(60).duration(300)} className="mx-5 mb-5">
              <View className="bg-white rounded-2xl p-4 border border-surface-border flex-row items-center">
                <View className="h-11 w-11 rounded-xl bg-orange-50 items-center justify-center mr-3">
                  <Ionicons name="flame" size={22} color="#f97316" />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-sans-medium text-text-tertiary">
                    {t('workout.estimatedBurn')}
                  </Text>
                  <Text className="text-xl font-sans-bold text-text-DEFAULT">
                    {estimate && currentDuration > 0 ? `${estimate.calorieBurned} kcal` : '— kcal'}
                  </Text>
                </View>
                {estimateLoading && <Ionicons name="hourglass-outline" size={16} color="#94a3b8" />}
              </View>
            </Animated.View>

            {/* Note */}
            <Animated.View entering={FadeInDown.delay(120).duration(300)} className="mx-5 mb-5">
              <Text className="text-sm font-sans-medium text-text-secondary mb-2">
                {t('workout.note')}
              </Text>
              <View className="bg-white rounded-2xl border border-surface-border">
                <TextInput
                  className="px-4 py-3 text-base font-sans text-text-DEFAULT min-h-[80px]"
                  placeholder={t('workout.notePlaceholder')}
                  placeholderTextColor="#94a3b8"
                  value={note}
                  onChangeText={setNote}
                  multiline
                  textAlignVertical="top"
                  maxLength={500}
                />
              </View>
              <Text className="text-xs text-text-tertiary font-sans mt-1 text-right">
                {note.length}/500
              </Text>
            </Animated.View>

            {/* Workout Info */}
            {typeInfo && (
              <Animated.View entering={FadeInDown.delay(180).duration(300)} className="mx-5 mb-5">
                <View className="bg-surface-secondary rounded-2xl p-4">
                  <View className="flex-row items-center mb-2">
                    <Text className="text-lg mr-2">{typeInfo.icon}</Text>
                    <Text className="text-sm font-sans-bold text-text-DEFAULT">
                      {locale === 'mn' ? typeInfo.label.mn : typeInfo.label.en}
                    </Text>
                  </View>
                  <View className="flex-row gap-4">
                    <View className="flex-row items-center">
                      <Ionicons name="speedometer-outline" size={14} color="#7687a2" />
                      <Text className="text-xs text-text-tertiary font-sans ml-1">
                        {typeInfo.met} MET
                      </Text>
                    </View>
                    <View className="flex-row items-center">
                      <Ionicons name="folder-outline" size={14} color="#7687a2" />
                      <Text className="text-xs text-text-tertiary font-sans ml-1 capitalize">
                        {typeInfo.category}
                      </Text>
                    </View>
                  </View>
                </View>
              </Animated.View>
            )}
          </ScrollView>

          {/* Bottom Action */}
          <View className="px-5 pb-4 pt-2 border-t border-surface-border bg-surface-app">
            <Button onPress={handleFinish} disabled={saving} variant="primary" size="lg">
              {saving ? t('common.loading') : t('workout.finishWorkout')}
            </Button>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
