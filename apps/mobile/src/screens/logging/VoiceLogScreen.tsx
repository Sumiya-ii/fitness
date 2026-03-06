import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card } from '../../components/ui';
import { mealsApi } from '../../api/meals';
import type { LogStackScreenProps } from '../../navigation/types';

type Props = LogStackScreenProps<'VoiceLog'>;

interface VoiceDraft {
  id: string;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  transcription?: string;
}

export function VoiceLogScreen() {
  const navigation = useNavigation<Props['navigation']>();
  const [recording, setRecording] = useState(false);
  const [draft, setDraft] = useState<VoiceDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  const _startPulse = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.95,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [pulseAnim]);

  const stopPulse = useCallback(() => {
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  }, [pulseAnim]);

  const handlePressIn = async () => {
    setError(null);
    setDraft(null);
    setError(
      'Voice recording is temporarily unavailable in this iOS build. Use text/photo logging for now.',
    );
  };

  const handlePressOut = async () => {
    stopPulse();
    setRecording(false);
    await Promise.resolve();
  };

  const handleConfirmSave = async () => {
    if (!draft?.transcription) return;
    setSaving(true);
    setError(null);

    try {
      const text = draft.transcription.trim();
      const calMatch = text.match(/(\d+)\s*(?:cal|kcal|калори)?/i);
      const calories = calMatch ? parseInt(calMatch[1], 10) : 0;

      await mealsApi.quickAdd({
        calories,
        proteinGrams: 0,
        carbsGrams: 0,
        fatGrams: 0,
        note: text,
        source: 'voice',
      });

      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    setDraft(null);
    navigation.goBack();
  };

  return (
    <View className="flex-1 bg-surface-app">
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="flex-row items-center px-4 py-3 border-b border-surface-border">
          <Pressable onPress={() => navigation.goBack()} className="p-1">
            <Ionicons name="arrow-back" size={24} color="#e2e8f0" />
          </Pressable>
          <Text className="ml-4 text-lg font-sans-semibold text-text">
            Voice Log
          </Text>
        </View>

        <View className="flex-1 items-center justify-center px-8">
          {!draft && (
            <>
              <Text className="mb-8 text-center text-text-secondary">
                Press and hold to record your meal. Speak clearly for best
                results.
              </Text>
              <Pressable
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                className="items-center justify-center"
              >
                <Animated.View
                  style={{ transform: [{ scale: pulseAnim }] }}
                  className="h-28 w-28 items-center justify-center rounded-full bg-primary-500"
                >
                  <Ionicons name="mic" size={48} color="#ffffff" />
                </Animated.View>
              </Pressable>
              {recording && (
                <Text className="mt-4 text-primary-400 font-sans-medium">
                  Recording...
                </Text>
              )}
              <Text className="mt-6 text-center text-sm text-text-tertiary">
                Voice quality affects accuracy. Please confirm parsed items
                before saving.
              </Text>
            </>
          )}

          {draft && (
            <View className="w-full">
              <Card className="mb-6">
                <Text className="mb-2 font-sans-semibold text-text">
                  Transcription
                </Text>
                <Text className="text-text-secondary">
                  {draft.transcription || 'No transcription available'}
                </Text>
                <Text className="mt-4 text-xs text-text-tertiary">
                  Review the text above and confirm to save as a meal log.
                </Text>
              </Card>
              {error && (
                <Text className="mb-4 text-center text-red-400">{error}</Text>
              )}
              <View className="flex-row gap-3">
                <Button
                  variant="outline"
                  onPress={handleDiscard}
                  className="flex-1"
                >
                  Discard
                </Button>
                <Button
                  onPress={handleConfirmSave}
                  loading={saving}
                  disabled={saving || !draft.transcription}
                  className="flex-1"
                >
                  Confirm & Save
                </Button>
              </View>
            </View>
          )}

          {error && !draft && (
            <Text className="mt-4 text-center text-red-400">{error}</Text>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}
