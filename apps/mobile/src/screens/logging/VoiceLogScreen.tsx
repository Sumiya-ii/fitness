import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card } from '../../components/ui';
import type { LogStackScreenProps } from '../../navigation/types';

type Props = LogStackScreenProps<'VoiceLog'>;

export function VoiceLogScreen() {
  const navigation = useNavigation<Props['navigation']>();
  const [, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [draft, setDraft] = useState<{ transcription?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const startPulse = useCallback(() => {
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
      ])
    ).start();
  }, [pulseAnim]);

  const stopPulse = useCallback(() => {
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  }, [pulseAnim]);

  const handlePressIn = () => {
    setRecording(true);
    setError(null);
    setDraft(null);
    startPulse();
  };

  const handlePressOut = async () => {
    setRecording(false);
    stopPulse();
    setProcessing(true);
    setError(null);
    try {
      // In production: use expo-av to record, upload via api.upload, poll draft
      await new Promise((r) => setTimeout(r, 2000));
      setDraft({
        transcription: 'Example: 2 eggs, 100g rice, 1 apple (parsed items would appear here)',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Processing failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmSave = async () => {
    setSaving(true);
    try {
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setDraft(null);
    navigation.goBack();
  };

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-slate-900" edges={['top']}>
      <View className="flex-row items-center border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <Pressable onPress={() => navigation.goBack()} className="p-1">
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </Pressable>
        <Text className="ml-4 text-lg font-sans-semibold text-text dark:text-slate-100">
          Voice Log
        </Text>
      </View>

      <View className="flex-1 items-center justify-center px-8">
        {processing && (
          <>
            <ActivityIndicator size="large" color="#22c55e" />
            <Text className="mt-4 text-text-secondary dark:text-slate-400">
              Processing...
            </Text>
          </>
        )}

        {!processing && !draft && (
          <>
            <Text className="mb-8 text-center text-text-secondary dark:text-slate-400">
              Press and hold to record your meal. Speak clearly for best results.
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
            <Text className="mt-6 text-center text-sm text-text-tertiary dark:text-slate-500">
              (AIR-001) Voice quality affects accuracy. Please confirm parsed items before saving.
            </Text>
          </>
        )}

        {draft && (
          <View className="w-full">
            <Card className="mb-6">
              <Text className="mb-2 font-sans-semibold text-text dark:text-slate-100">
                Parsed draft
              </Text>
              <Text className="text-text-secondary dark:text-slate-400">
                {draft.transcription || 'No transcription available'}
              </Text>
              <Text className="mt-4 text-xs text-text-tertiary dark:text-slate-500">
                Editable quantities would appear here. Confirm before saving.
              </Text>
            </Card>
            {error && (
              <Text className="mb-4 text-center text-danger">{error}</Text>
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
                disabled={saving}
                className="flex-1"
              >
                Confirm & Save
              </Button>
            </View>
          </View>
        )}

        {error && !draft && !processing && (
          <Text className="mt-4 text-center text-danger">{error}</Text>
        )}
      </View>
    </SafeAreaView>
  );
}
