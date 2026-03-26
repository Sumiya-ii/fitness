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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/types';
import { BackButton, Button, Input } from '../components/ui';
import { useAuthStore } from '../stores/auth.store';
import { useLocale } from '../i18n';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

type PasswordStrength = 'weak' | 'fair' | 'strong';

function getPasswordStrength(password: string): PasswordStrength {
  if (password.length < 8) return 'weak';
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  if (hasUpper && hasNumber) return 'strong';
  return 'fair';
}

const strengthConfig: Record<
  PasswordStrength,
  { labelKey: string; color: string; segments: number }
> = {
  weak: { labelKey: 'auth.weak', color: '#ef4444', segments: 1 },
  fair: { labelKey: 'auth.fair', color: '#f97316', segments: 2 },
  strong: { labelKey: 'auth.strong', color: '#22c55e', segments: 3 },
};

function PasswordStrengthBar({ password, t }: { password: string; t: (key: string) => string }) {
  if (!password) return null;
  const strength = getPasswordStrength(password);
  const { labelKey, color, segments } = strengthConfig[strength];
  return (
    <View className="mt-2 mb-4">
      <View className="flex-row gap-1 mb-1">
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            className="flex-1 h-1 rounded-full"
            style={{ backgroundColor: i <= segments ? color : '#e2e8f0' }}
          />
        ))}
      </View>
      <Text className="text-xs font-sans-medium" style={{ color }}>
        {t(labelKey)}
      </Text>
    </View>
  );
}

export function SignUpScreen({ navigation }: Props) {
  const { t } = useLocale();
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

  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setIsAppleAvailable);
  }, []);

  const isLoading = loading !== null;
  const passwordsMatch = !confirmPassword || password === confirmPassword;
  const isValid =
    email.trim() && password.length >= 6 && password === confirmPassword && acceptedTerms;

  const handleGoogle = async () => {
    setError(null);
    setLoading('google');
    try {
      await signInWithGoogleStore();
    } catch (err) {
      if (err instanceof Error && err.message !== 'CANCELLED') setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  const handleApple = async () => {
    setError(null);
    setLoading('apple');
    try {
      await signInWithAppleStore();
    } catch (err) {
      if (err instanceof Error && err.message !== 'CANCELLED') setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  const handleCreateAccount = async () => {
    if (!isValid) return;
    setError(null);
    setLoading('email');
    try {
      await signUp(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-1 px-6 pt-4">
            {/* Header */}
            <BackButton />
            <Text className="text-3xl font-sans-bold text-text mb-1 mt-6">{t('auth.signUp')}</Text>
            <Text className="text-base text-text-secondary mb-8">
              {t('auth.createAccountDesc')}
            </Text>

            {/* Social buttons */}
            <View className="gap-3 mb-6">
              <Pressable
                onPress={handleGoogle}
                disabled={isLoading}
                className="flex-row items-center justify-center bg-white border border-surface-border rounded-2xl py-4 active:opacity-80"
                style={{ opacity: isLoading ? 0.7 : 1 }}
              >
                {loading === 'google' ? (
                  <ActivityIndicator size="small" color="#0f172a" />
                ) : (
                  <>
                    <Ionicons name="logo-google" size={20} color="#0f172a" />
                    <Text className="ml-3 text-base font-sans-semibold text-text">
                      {t('auth.continueWithGoogle')}
                    </Text>
                  </>
                )}
              </Pressable>

              {isAppleAvailable && (
                <Pressable
                  onPress={handleApple}
                  disabled={isLoading}
                  className="flex-row items-center justify-center rounded-2xl py-4 active:opacity-80"
                  style={{ backgroundColor: '#0f172a', opacity: isLoading ? 0.7 : 1 }}
                >
                  {loading === 'apple' ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Ionicons name="logo-apple" size={20} color="#ffffff" />
                      <Text className="ml-3 text-base font-sans-semibold text-white">
                        {t('auth.continueWithApple')}
                      </Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>

            {/* Divider */}
            <View className="flex-row items-center gap-4 mb-6">
              <View className="flex-1 h-px bg-surface-secondary" />
              <Text className="text-xs text-text-tertiary font-sans-medium">
                {t('auth.orWithEmail')}
              </Text>
              <View className="flex-1 h-px bg-surface-secondary" />
            </View>

            {/* Email form */}
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
            />

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
              rightIcon={
                <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={12}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color="#7687a2"
                  />
                </Pressable>
              }
            />
            <PasswordStrengthBar password={password} t={t} />

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
            />

            {/* Terms */}
            <Pressable
              onPress={() => setAcceptedTerms((v) => !v)}
              className="flex-row items-center mb-6"
              disabled={isLoading}
            >
              <View
                className={`w-5 h-5 rounded border-2 mr-3 items-center justify-center ${
                  acceptedTerms
                    ? 'bg-primary-500 border-primary-500'
                    : 'border-surface-border bg-surface-default'
                }`}
              >
                {acceptedTerms && <Ionicons name="checkmark" size={14} color="white" />}
              </View>
              <Text className="flex-1 text-sm text-text-secondary">
                {t('auth.agreePrefix')}{' '}
                <Text className="text-primary-600">{t('auth.termsOfService')}</Text> {t('auth.and')}{' '}
                <Text className="text-primary-600">{t('auth.privacyPolicy')}</Text>
              </Text>
            </Pressable>

            {error ? (
              <View className="flex-row items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-4">
                <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
                <Text className="text-sm text-red-500 flex-1">{error}</Text>
              </View>
            ) : null}

            <Button
              onPress={handleCreateAccount}
              size="lg"
              loading={loading === 'email'}
              disabled={!isValid || isLoading}
              className="w-full mb-6"
            >
              {t('auth.signUp')}
            </Button>

            <Pressable
              onPress={() => navigation.navigate('SignIn')}
              className="self-center py-2 active:opacity-70"
            >
              <Text className="text-base text-text-secondary">
                {t('auth.haveAccount')}{' '}
                <Text className="text-primary-600 font-sans-semibold">{t('auth.signIn')}</Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
