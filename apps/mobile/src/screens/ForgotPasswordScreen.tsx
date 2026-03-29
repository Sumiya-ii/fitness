import { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../navigation/types';
import { BackButton, Button, Input } from '../components/ui';
import { resetPassword } from '../services/firebase-auth.service';
import { useLocale } from '../i18n';
import { useColors } from '../theme';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation }: Props) {
  const { t } = useLocale();
  const c = useColors();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setError(null);
    setLoading(true);
    try {
      await resetPassword(email.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.resetError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-app">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="flex-grow pb-8"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-1 px-6 pt-4">
            {/* Back button */}
            <Animated.View entering={FadeInDown.duration(400).delay(0)}>
              <BackButton />
            </Animated.View>

            {/* Header */}
            <Animated.View entering={FadeInDown.duration(400).delay(50)}>
              <Text
                className="text-3xl font-sans-bold text-text mt-8 mb-1 leading-9"
                accessibilityRole="header"
              >
                {t('auth.resetPassword')}
              </Text>
              <Text className="text-base font-sans text-text-secondary mb-8 leading-6">
                {t('auth.resetPasswordDesc')}
              </Text>
            </Animated.View>

            {sent ? (
              /* Success state */
              <Animated.View entering={FadeInDown.duration(400).delay(100)}>
                <View
                  className="flex-row items-start gap-3 rounded-2xl px-4 py-4 mb-6"
                  style={{ backgroundColor: `${c.success}15` }}
                  accessibilityRole="alert"
                >
                  <View
                    className="w-8 h-8 rounded-full items-center justify-center mt-0.5"
                    style={{ backgroundColor: `${c.success}20` }}
                  >
                    <Ionicons name="checkmark-circle" size={20} color={c.success} />
                  </View>
                  <Text className="text-sm font-sans flex-1 leading-5" style={{ color: c.success }}>
                    {`${t('auth.checkInbox')} ${email.trim()}.`}
                  </Text>
                </View>

                <Button
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    navigation.navigate('SignIn');
                  }}
                  variant="outline"
                  size="lg"
                  className="w-full"
                  accessibilityLabel={t('auth.backToSignIn')}
                >
                  {t('auth.backToSignIn')}
                </Button>
              </Animated.View>
            ) : (
              /* Input state */
              <>
                <Animated.View entering={FadeInDown.duration(400).delay(100)}>
                  <Input
                    label={t('auth.email')}
                    placeholder={t('auth.emailPlaceholder')}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    returnKeyType="send"
                    onSubmitEditing={handleSubmit}
                    editable={!loading}
                    containerClassName="mb-4"
                    accessibilityLabel={t('auth.email')}
                  />
                </Animated.View>

                {/* Error banner */}
                {error ? (
                  <Animated.View
                    entering={FadeInDown.duration(300)}
                    className="flex-row items-center gap-3 rounded-2xl px-4 py-3 mb-4"
                    style={{ backgroundColor: `${c.danger}15` }}
                    accessibilityRole="alert"
                  >
                    <Ionicons name="alert-circle-outline" size={18} color={c.danger} />
                    <Text
                      className="text-sm font-sans flex-1 leading-5"
                      style={{ color: c.danger }}
                    >
                      {error}
                    </Text>
                  </Animated.View>
                ) : null}

                <Animated.View entering={FadeInDown.duration(400).delay(150)}>
                  <Button
                    onPress={handleSubmit}
                    size="lg"
                    loading={loading}
                    disabled={!email.trim() || loading}
                    className="w-full"
                    accessibilityLabel={t('auth.sendResetLink')}
                  >
                    {t('auth.sendResetLink')}
                  </Button>
                </Animated.View>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
