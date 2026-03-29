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
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../navigation/types';
import { BackButton, Button, Input } from '../components/ui';
import { useAuthStore } from '../stores/auth.store';
import { useLocale } from '../i18n';
import { useColors } from '../theme';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'SignIn'>;

export function SignInScreen({ navigation }: Props) {
  const { t } = useLocale();
  const c = useColors();
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setError(null);
    setLoading('email');
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.signInError'));
    } finally {
      setLoading(null);
    }
  };

  const togglePasswordVisibility = () => {
    Haptics.selectionAsync();
    setShowPassword((v) => !v);
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
                {t('auth.signIn')}
              </Text>
              <Text className="text-base font-sans text-text-secondary mb-8 leading-6">
                {t('auth.welcomeBackDesc')}
              </Text>
            </Animated.View>

            {/* Social sign-in buttons */}
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
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password"
                returnKeyType="go"
                onSubmitEditing={handleSignIn}
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
                containerClassName="mb-2"
              />

              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  navigation.navigate('ForgotPassword');
                }}
                accessibilityRole="link"
                accessibilityLabel={t('auth.forgotPassword')}
                className="self-end mb-6 py-2 px-1"
              >
                <Text className="text-sm text-primary-600 font-sans-medium leading-5">
                  {t('auth.forgotPassword')}
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
            <Animated.View entering={FadeInDown.duration(400).delay(300)}>
              <Button
                onPress={handleSignIn}
                size="lg"
                loading={loading === 'email'}
                disabled={!email.trim() || !password || isLoading}
                className="w-full mb-6"
                accessibilityLabel={t('auth.signIn')}
              >
                {t('auth.signIn')}
              </Button>
            </Animated.View>

            {/* Switch to Sign Up */}
            <Animated.View entering={FadeInDown.duration(400).delay(350)} className="items-center">
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  navigation.navigate('SignUp');
                }}
                accessibilityRole="link"
                accessibilityLabel={`${t('auth.noAccount')} ${t('auth.signUp')}`}
                className="py-2 px-4 active:opacity-70"
              >
                <Text className="text-base font-sans text-text-secondary leading-6">
                  {t('auth.noAccount')}{' '}
                  <Text className="text-primary-600 font-sans-semibold">{t('auth.signUp')}</Text>
                </Text>
              </Pressable>
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
