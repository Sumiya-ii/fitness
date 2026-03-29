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
import type { OnboardingStackParamList } from '../navigation/types';
import { BackButton, Button, Input } from '../components/ui';
import { useAuthStore } from '../stores/auth.store';
import { useLocale } from '../i18n';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'SignIn'>;

export function SignInScreen({ navigation }: Props) {
  const { t } = useLocale();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState<'email' | 'google' | 'apple' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const signIn = useAuthStore((s) => s.signIn);
  const signInWithGoogleStore = useAuthStore((s) => s.signInWithGoogle);
  const signInWithAppleStore = useAuthStore((s) => s.signInWithApple);

  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setIsAppleAvailable);
  }, []);

  const isLoading = loading !== null;

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

  const handleSignIn = async () => {
    if (!email.trim() || !password) return;
    setError(null);
    setLoading('email');
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#000000' }}>
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
            <Text className="text-3xl font-sans-bold text-text mb-1 mt-6">{t('auth.signIn')}</Text>
            <Text className="text-base text-text-secondary mb-8">{t('auth.welcomeBackDesc')}</Text>

            {/* Social buttons */}
            <View className="gap-3 mb-6">
              <Pressable
                onPress={handleGoogle}
                disabled={isLoading}
                className="flex-row items-center justify-center border border-surface-border rounded-2xl py-4 active:opacity-80"
                style={{ backgroundColor: '#1c1c1e', opacity: isLoading ? 0.7 : 1 }}
              >
                {loading === 'google' ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="logo-google" size={20} color="#ffffff" />
                    <Text className="ml-3 text-base font-sans-semibold text-text">
                      Continue with Google
                    </Text>
                  </>
                )}
              </Pressable>

              {isAppleAvailable && (
                <Pressable
                  onPress={handleApple}
                  disabled={isLoading}
                  className="flex-row items-center justify-center rounded-2xl py-4 active:opacity-80"
                  style={{ backgroundColor: '#ffffff', opacity: isLoading ? 0.7 : 1 }}
                >
                  {loading === 'apple' ? (
                    <ActivityIndicator size="small" color="#000000" />
                  ) : (
                    <>
                      <Ionicons name="logo-apple" size={20} color="#000000" />
                      <Text className="ml-3 text-base font-sans-semibold text-black">
                        Continue with Apple
                      </Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>

            {/* Divider */}
            <View className="flex-row items-center gap-4 mb-6">
              <View className="flex-1 h-px bg-surface-secondary" />
              <Text className="text-xs text-text-tertiary font-sans-medium">or with email</Text>
              <View className="flex-1 h-px bg-surface-secondary" />
            </View>

            {/* Email form */}
            <Input
              label={t('auth.email')}
              placeholder="you@example.com"
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
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="password"
              returnKeyType="go"
              onSubmitEditing={handleSignIn}
              editable={!isLoading}
              rightIcon={
                <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={12}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color="#71717a"
                  />
                </Pressable>
              }
              containerClassName="mb-2"
            />

            <Pressable
              onPress={() => navigation.navigate('ForgotPassword')}
              className="self-end mb-6 py-1"
              hitSlop={8}
            >
              <Text className="text-sm text-primary-600 font-sans-medium">Forgot password?</Text>
            </Pressable>

            {error ? (
              <View className="flex-row items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-4">
                <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
                <Text className="text-sm text-red-500 flex-1">{error}</Text>
              </View>
            ) : null}

            <Button
              onPress={handleSignIn}
              size="lg"
              loading={loading === 'email'}
              disabled={!email.trim() || !password || isLoading}
              className="w-full mb-6"
            >
              {t('auth.signIn')}
            </Button>

            <Pressable
              onPress={() => navigation.navigate('SignUp')}
              className="self-center py-2 active:opacity-70"
            >
              <Text className="text-base text-text-secondary">
                {t('auth.noAccount')}{' '}
                <Text className="text-primary-600 font-sans-semibold">{t('auth.signUp')}</Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
