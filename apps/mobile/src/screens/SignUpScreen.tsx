import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../navigation/types';
import { BackButton, Button, Input } from '../components/ui';
import { useAuthStore } from '../stores/auth.store';
import { useOnboardingStore } from '../stores/onboarding.store';
import { useLocale } from '../i18n';
import { useColors } from '../theme';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'SignUp'>;

type PasswordStrength = 'weak' | 'fair' | 'strong';

function getPasswordStrength(password: string): PasswordStrength {
  if (password.length < 8) return 'weak';
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  if (hasUpper && hasNumber) return 'strong';
  return 'fair';
}

function PasswordStrengthBar({
  password,
  t,
  c,
}: {
  password: string;
  t: (key: string) => string;
  c: ReturnType<typeof useColors>;
}) {
  if (!password) return null;
  const strength = getPasswordStrength(password);

  const strengthConfig: Record<
    PasswordStrength,
    { labelKey: string; color: string; segments: number }
  > = {
    weak: { labelKey: 'auth.weak', color: c.danger, segments: 1 },
    fair: { labelKey: 'auth.fair', color: c.warning, segments: 2 },
    strong: { labelKey: 'auth.strong', color: c.success, segments: 3 },
  };

  const { labelKey, color, segments } = strengthConfig[strength];

  return (
    <View
      className="mt-2 mb-4"
      accessibilityLabel={`${t('auth.passwordStrength')}: ${t(labelKey)}`}
    >
      <View className="flex-row gap-1.5 mb-1.5">
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            className="flex-1 h-1 rounded-full"
            style={{ backgroundColor: i <= segments ? color : c.border }}
          />
        ))}
      </View>
      <Text className="text-xs font-sans-medium leading-4" style={{ color }}>
        {t(labelKey)}
      </Text>
    </View>
  );
}

export function SignUpScreen({ navigation }: Props) {
  const { t } = useLocale();
  const c = useColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState<'email' | 'google' | 'apple' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const signUp = useAuthStore((s) => s.signUp);
  const signInWithGoogleStore = useAuthStore((s) => s.signInWithGoogle);
  const signInWithAppleStore = useAuthStore((s) => s.signInWithApple);
  const submitCachedOnboardingData = useOnboardingStore((s) => s.submitCachedOnboardingData);

  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setIsAppleAvailable);
  }, []);

  const isLoading = loading !== null;
  const passwordsMatch = !confirmPassword || password === confirmPassword;
  const isValid =
    email.trim() && password.length >= 6 && password === confirmPassword && acceptedTerms;

  const submitAndNavigate = async () => {
    try {
      await submitCachedOnboardingData();
    } catch {
      // Submission failed — RootNavigator will retry on next launch
    }
    navigation.navigate('SubscriptionPitch');
  };

  const handleGoogle = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setError(null);
    setLoading('google');
    try {
      await signInWithGoogleStore();
      await submitAndNavigate();
    } catch (err) {
      if (err instanceof Error && err.message !== 'CANCELLED') setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  const handleApple = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setError(null);
    setLoading('apple');
    try {
      await signInWithAppleStore();
      await submitAndNavigate();
    } catch (err) {
      if (err instanceof Error && err.message !== 'CANCELLED') setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  const handleCreateAccount = async () => {
    if (!isValid) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setError(null);
    setLoading('email');
    try {
      await signUp(email.trim(), password);
      await submitAndNavigate();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.signUpError'));
    } finally {
      setLoading(null);
    }
  };

  const togglePasswordVisibility = () => {
    Haptics.selectionAsync();
    setShowPassword((v) => !v);
  };

  const toggleTerms = () => {
    Haptics.selectionAsync();
    setAcceptedTerms((v) => !v);
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
                {t('auth.signUp')}
              </Text>
              <Text className="text-base font-sans text-text-secondary mb-8 leading-6">
                {t('auth.createAccountDesc')}
              </Text>
            </Animated.View>

            {/* Social sign-up buttons */}
            <Animated.View entering={FadeInDown.duration(400).delay(100)} className="gap-3 mb-6">
              <Pressable
                onPress={handleGoogle}
                disabled={isLoading}
                accessibilityRole="button"
                accessibilityLabel={t('auth.continueWithGoogle')}
                className="flex-row items-center justify-center bg-surface-default border border-surface-border rounded-2xl min-h-[52px] active:opacity-80"
                style={{ opacity: isLoading ? 0.6 : 1 }}
              >
                {loading === 'google' ? (
                  <ActivityIndicator size="small" color={c.text} />
                ) : (
                  <>
                    <Ionicons name="logo-google" size={20} color={c.text} />
                    <Text className="ml-3 text-base font-sans-semibold text-text leading-6">
                      {t('auth.continueWithGoogle')}
                    </Text>
                  </>
                )}
              </Pressable>

              {isAppleAvailable && (
                <Pressable
                  onPress={handleApple}
                  disabled={isLoading}
                  accessibilityRole="button"
                  accessibilityLabel={t('auth.continueWithApple')}
                  className="flex-row items-center justify-center rounded-2xl min-h-[52px] active:opacity-80"
                  style={{
                    backgroundColor: c.text,
                    opacity: isLoading ? 0.6 : 1,
                  }}
                >
                  {loading === 'apple' ? (
                    <ActivityIndicator size="small" color={c.bg} />
                  ) : (
                    <>
                      <Ionicons name="logo-apple" size={20} color={c.bg} />
                      <Text
                        className="ml-3 text-base font-sans-semibold leading-6"
                        style={{ color: c.bg }}
                      >
                        {t('auth.continueWithApple')}
                      </Text>
                    </>
                  )}
                </Pressable>
              )}
            </Animated.View>

            {/* Divider */}
            <Animated.View
              entering={FadeInDown.duration(400).delay(150)}
              className="flex-row items-center gap-4 mb-6"
            >
              <View className="flex-1 h-px bg-surface-secondary" />
              <Text className="text-xs text-text-tertiary font-sans-medium leading-4">
                {t('auth.orWithEmail')}
              </Text>
              <View className="flex-1 h-px bg-surface-secondary" />
            </Animated.View>

            {/* Email form */}
            <Animated.View entering={FadeInDown.duration(400).delay(200)}>
              <Input
                label={t('auth.email')}
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                containerClassName="mb-4"
                editable={!isLoading}
                accessibilityLabel={t('auth.email')}
              />
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(400).delay(250)}>
              <Input
                ref={passwordRef}
                label={t('auth.password')}
                placeholder={t('auth.minChars')}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="new-password"
                returnKeyType="next"
                onSubmitEditing={() => confirmRef.current?.focus()}
                editable={!isLoading}
                accessibilityLabel={t('auth.password')}
                rightIcon={
                  <Pressable
                    onPress={togglePasswordVisibility}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel={t('auth.togglePasswordVisibility')}
                    className="w-11 h-11 items-center justify-center -mr-2"
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={22}
                      color={c.textTertiary}
                    />
                  </Pressable>
                }
              />
              <PasswordStrengthBar password={password} t={t} c={c} />
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(400).delay(300)}>
              <Input
                ref={confirmRef}
                label={t('auth.confirmPassword')}
                placeholder="••••••••"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleCreateAccount}
                editable={!isLoading}
                error={!passwordsMatch ? t('auth.passwordsDoNotMatch') : undefined}
                containerClassName="mb-6"
                accessibilityLabel={t('auth.confirmPassword')}
              />
            </Animated.View>

            {/* Terms checkbox */}
            <Animated.View entering={FadeInDown.duration(400).delay(350)}>
              <Pressable
                onPress={toggleTerms}
                disabled={isLoading}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: acceptedTerms }}
                accessibilityLabel={`${t('auth.agreePrefix')} ${t('auth.termsOfService')} ${t('auth.and')} ${t('auth.privacyPolicy')}`}
                className="flex-row items-start mb-6 py-1"
              >
                <View
                  className="w-6 h-6 rounded-md mr-3 mt-0.5 items-center justify-center"
                  style={{
                    backgroundColor: acceptedTerms ? c.primary : 'transparent',
                    borderWidth: 2,
                    borderColor: acceptedTerms ? c.primary : c.border,
                  }}
                >
                  {acceptedTerms && <Ionicons name="checkmark" size={16} color={c.onPrimary} />}
                </View>
                <Text className="flex-1 text-sm font-sans text-text-secondary leading-5">
                  {t('auth.agreePrefix')}{' '}
                  <Text
                    className="text-primary-600 font-sans-medium"
                    onPress={() => Linking.openURL('https://www.nexuskairos.com/coach/terms')}
                    accessibilityRole="link"
                    accessibilityLabel={t('auth.termsOfService')}
                  >
                    {t('auth.termsOfService')}
                  </Text>{' '}
                  {t('auth.and')}{' '}
                  <Text
                    className="text-primary-600 font-sans-medium"
                    onPress={() => Linking.openURL('https://www.nexuskairos.com/coach/privacy')}
                    accessibilityRole="link"
                    accessibilityLabel={t('auth.privacyPolicy')}
                  >
                    {t('auth.privacyPolicy')}
                  </Text>
                </Text>
              </Pressable>
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
                <Text className="text-sm font-sans flex-1 leading-5" style={{ color: c.danger }}>
                  {error}
                </Text>
              </Animated.View>
            ) : null}

            {/* Submit */}
            <Animated.View entering={FadeInDown.duration(400).delay(400)}>
              <Button
                onPress={handleCreateAccount}
                size="lg"
                loading={loading === 'email'}
                disabled={!isValid || isLoading}
                className="w-full mb-6"
                accessibilityLabel={t('auth.signUp')}
              >
                {t('auth.signUp')}
              </Button>
            </Animated.View>

            {/* Switch to Sign In */}
            <Animated.View entering={FadeInDown.duration(400).delay(450)} className="items-center">
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  navigation.navigate('SignIn');
                }}
                accessibilityRole="link"
                accessibilityLabel={`${t('auth.haveAccount')} ${t('auth.signIn')}`}
                className="py-2 px-4 active:opacity-70"
              >
                <Text className="text-base font-sans text-text-secondary leading-6">
                  {t('auth.haveAccount')}{' '}
                  <Text className="text-primary-600 font-sans-semibold">{t('auth.signIn')}</Text>
                </Text>
              </Pressable>
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
