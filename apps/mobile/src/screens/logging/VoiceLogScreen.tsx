import { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync } from 'expo-audio';
import { BackButton } from '../../components/ui';
import { api } from '../../api';
import { mealsApi } from '../../api/meals';
import type { LogStackScreenProps } from '../../navigation/types';

type Props = LogStackScreenProps<'VoiceLog'>;

interface ParsedFoodItem {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface VoiceDraft {
  id: string;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  transcription?: string;
  items?: ParsedFoodItem[];
  totalCalories?: number;
  totalProtein?: number;
  totalCarbs?: number;
  totalFat?: number;
}

type ScreenState = 'idle' | 'recording' | 'uploading' | 'processing' | 'results' | 'saving';

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 30;

export function VoiceLogScreen() {
  const navigation = useNavigation<Props['navigation']>();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [screenState, setScreenState] = useState<ScreenState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [draftItems, setDraftItems] = useState<ParsedFoodItem[]>([]);
  const [transcription, setTranscription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  const formatElapsed = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const startRecording = async () => {
    setError(null);
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      Alert.alert('Permission needed', 'Microphone access is required for voice logging.');
      return;
    }
    recorder.record();
    setScreenState('recording');
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  };

  const stopRecording = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    await recorder.stop();
    const uri = recorder.uri;
    if (!uri) {
      setError('Recording failed. Please try again.');
      setScreenState('idle');
      return;
    }
    await uploadAudio(uri);
  };

  const uploadAudio = async (uri: string) => {
    setScreenState('uploading');
    try {
      const formData = new FormData();
      formData.append('audio', {
        uri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      } as unknown as Blob);
      const res = await api.upload<{ data: { draftId: string } }>('/voice/upload', formData);
      setScreenState('processing');
      pollDraft(res.data.draftId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
      setScreenState('idle');
    }
  };

  const pollDraft = async (draftId: string, attempt = 0) => {
    if (attempt >= MAX_POLL_ATTEMPTS) {
      setError('Processing timed out. Please try again.');
      setScreenState('idle');
      return;
    }
    try {
      const res = await api.get<{ data: VoiceDraft }>(`/voice/drafts/${draftId}`);
      const d = res.data;

      if (d.status === 'completed') {
        setTranscription(d.transcription ?? '');
        setDraftItems(d.items ?? []);
        setScreenState('results');
        return;
      }

      if (d.status === 'failed') {
        setError('Processing failed. Please try again.');
        setScreenState('idle');
        return;
      }

      pollTimerRef.current = setTimeout(() => pollDraft(draftId, attempt + 1), POLL_INTERVAL_MS);
    } catch {
      setError('Failed to check processing status.');
      setScreenState('idle');
    }
  };

  const handleSave = async () => {
    if (draftItems.length === 0) return;
    setScreenState('saving');
    setError(null);
    try {
      const totalCalories = draftItems.reduce((s, i) => s + i.calories, 0);
      const totalProtein = draftItems.reduce((s, i) => s + i.protein, 0);
      const totalCarbs = draftItems.reduce((s, i) => s + i.carbs, 0);
      const totalFat = draftItems.reduce((s, i) => s + i.fat, 0);
      const note = `Voice: ${draftItems.map((i) => i.name).join(', ')}`;

      await mealsApi.quickAdd({
        calories: Math.round(totalCalories),
        proteinGrams: Math.round(totalProtein * 10) / 10,
        carbsGrams: Math.round(totalCarbs * 10) / 10,
        fatGrams: Math.round(totalFat * 10) / 10,
        note,
        source: 'voice',
      });

      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
      setScreenState('results');
    }
  };

  const handleReset = () => {
    setScreenState('idle');
    setDraftItems([]);
    setTranscription('');
    setError(null);
    setElapsed(0);
  };

  return (
    <View className="flex-1 bg-surface-app">
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="flex-row items-center px-4 py-3 border-b border-surface-border">
          <BackButton />
          <Text className="ml-3 text-lg font-sans-semibold text-text">Voice Log</Text>
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
          {screenState === 'idle' && (
            <View className="flex-1 items-center justify-center px-8 py-16">
              <Text className="text-text-secondary text-center mb-10 text-base leading-6">
                Tap the microphone and describe what you ate in Mongolian or English.
              </Text>
              <Pressable
                onPress={startRecording}
                className="h-28 w-28 rounded-full bg-primary-500 items-center justify-center"
              >
                <Ionicons name="mic" size={52} color="#ffffff" />
              </Pressable>
              <Text className="mt-5 text-text-secondary text-sm">Tap to start recording</Text>
              {error && <Text className="mt-6 text-center text-red-400 text-sm px-4">{error}</Text>}
            </View>
          )}

          {screenState === 'recording' && (
            <View className="flex-1 items-center justify-center px-8 py-16">
              <Text className="text-text-secondary text-center mb-6 text-base">
                Listening... speak clearly.
              </Text>
              <Text className="text-text font-sans-bold text-5xl mb-10 tabular-nums">
                {formatElapsed(elapsed)}
              </Text>
              <Pressable
                onPress={stopRecording}
                className="h-28 w-28 rounded-full bg-red-500 items-center justify-center"
              >
                <Ionicons name="stop" size={46} color="#ffffff" />
              </Pressable>
              <Text className="mt-5 text-text-secondary text-sm">Tap to stop</Text>
            </View>
          )}

          {(screenState === 'uploading' || screenState === 'processing') && (
            <View className="flex-1 items-center justify-center px-8 py-16">
              <ActivityIndicator size="large" color="#1f2028" />
              <Text className="mt-5 text-text-secondary text-base">
                {screenState === 'uploading' ? 'Uploading audio...' : 'Analyzing your meal...'}
              </Text>
            </View>
          )}

          {(screenState === 'results' || screenState === 'saving') && (
            <View className="px-4 py-5">
              {transcription.length > 0 && (
                <View className="rounded-xl bg-surface-card border border-surface-border p-4 mb-4">
                  <Text className="text-xs font-sans-semibold text-text-secondary uppercase tracking-wider mb-2">
                    What you said
                  </Text>
                  <Text className="text-text text-sm leading-5 italic">"{transcription}"</Text>
                </View>
              )}

              {draftItems.length > 0 && (
                <>
                  <Text className="font-sans-semibold text-text mb-3">Identified foods</Text>
                  {draftItems.map((item, index) => (
                    <View
                      key={`${item.name}-${index}`}
                      className="rounded-xl bg-surface-card border border-surface-border p-4 mb-3"
                    >
                      <View className="flex-row items-center justify-between">
                        <View className="flex-1 mr-3">
                          <Text className="font-sans-semibold text-text">{item.name}</Text>
                          <Text className="text-xs text-text-secondary mt-1">
                            P: {Math.round(item.protein)}g · C: {Math.round(item.carbs)}g · F:{' '}
                            {Math.round(item.fat)}g
                          </Text>
                        </View>
                        <Text className="font-sans-bold text-text text-base">
                          {Math.round(item.calories)} cal
                        </Text>
                      </View>
                    </View>
                  ))}

                  <View className="rounded-xl bg-surface-secondary border border-surface-border p-4 mb-6">
                    <Text className="text-xs font-sans-semibold text-text-secondary uppercase tracking-wider mb-1">
                      Total
                    </Text>
                    <Text className="text-text font-sans-bold text-2xl">
                      {Math.round(draftItems.reduce((s, i) => s + i.calories, 0))} cal
                    </Text>
                    <Text className="text-xs text-text-secondary mt-1">
                      P: {Math.round(draftItems.reduce((s, i) => s + i.protein, 0))}g · C:{' '}
                      {Math.round(draftItems.reduce((s, i) => s + i.carbs, 0))}g · F:{' '}
                      {Math.round(draftItems.reduce((s, i) => s + i.fat, 0))}g
                    </Text>
                  </View>
                </>
              )}

              {draftItems.length === 0 && (
                <View className="items-center py-10">
                  <Ionicons name="alert-circle-outline" size={40} color="#9a9caa" />
                  <Text className="text-text-secondary mt-3 text-base">
                    No food items could be identified.
                  </Text>
                </View>
              )}

              {error && <Text className="mb-4 text-center text-red-400 text-sm">{error}</Text>}

              <View className="gap-3">
                {draftItems.length > 0 && (
                  <Pressable
                    onPress={handleSave}
                    disabled={screenState === 'saving'}
                    className="rounded-2xl bg-primary-500 px-6 py-4 items-center"
                  >
                    {screenState === 'saving' ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <Text className="font-sans-semibold text-text-inverse text-base">
                        Log Meal
                      </Text>
                    )}
                  </Pressable>
                )}
                <Pressable
                  onPress={handleReset}
                  className="rounded-2xl border border-surface-border px-6 py-4 items-center"
                >
                  <Text className="font-sans-semibold text-text-secondary text-base">
                    Record Again
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
