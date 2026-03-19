import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/types';
import { AuthProviderButton, Button, Card, IconButton, Input } from '../components/ui';
import { useAuthStore } from '../stores/auth.store';
import { useLocale } from '../i18n';
import { themeColors } from '../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;

export function SignInScreen({ navigation }: Props) {
  const { t } = useLocale();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useAuthStore((s) => s.signIn);
  const signInWithGoogleStore = useAuthStore((s) => s.signInWithGoogle);
  const signInWithAppleStore = useAuthStore((s) => s.signInWithApple);
  const [isAppleAvailable, setIsAppleAvailable] = useState<boolean | null>(null);

  useState(() => {
    AppleAuthentication.isAvailableAsync().then(setIsAppleAvailable);
  });

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogleStore();
    } catch (err) {
      if (err instanceof Error && err.message !== 'CANCELLED') {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithAppleStore();
    } catch (err) {
      if (err instanceof Error && err.message !== 'CANCELLED') {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-app">
      <LinearGradient
        colors={[themeColors.surface.app, themeColors.surface.tertiary, themeColors.surface.app]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="absolute inset-0"
      />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-1 px-6 pt-4">
            <Pressable onPress={() => navigation.goBack()} className="absolute top-4 left-6 z-10">
              <IconButton icon="arrow-back" />
            </Pressable>
            <Text className="text-3xl font-sans-bold text-text mb-1 mt-10">{t('auth.signIn')}</Text>
            <Text className="text-base text-text-secondary mb-8">{t('auth.welcomeBackDesc')}</Text>

            <Card className="rounded-3xl p-4 mb-6">
              <Input
                label={t('auth.email')}
                placeholder="you@example.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                containerClassName="mb-4"
              />

              <Input
                label={t('auth.password')}
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password"
                rightIcon={
                  <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={12}>
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={22}
                      color="#7687a2"
                    />
                  </Pressable>
                }
                containerClassName="mb-6"
              />

              <Button
                onPress={handleSignIn}
                size="lg"
                loading={loading}
                disabled={!email || !password}
                className="w-full mb-6"
              >
                {t('auth.signIn')}
              </Button>

              {error ? <Text className="text-sm text-red-400 mb-4">{error}</Text> : null}
            </Card>

            <View className="flex-row items-center gap-4 mb-6">
              <View className="flex-1 h-px bg-surface-secondary" />
              <Text className="text-sm text-text-tertiary font-sans-medium">
                {t('auth.orContinueWith')}
              </Text>
              <View className="flex-1 h-px bg-surface-secondary" />
            </View>

            <View className="flex-row gap-3 mb-8">
              <AuthProviderButton
                icon="logo-google"
                label="Google"
                onPress={handleGoogleSignIn}
                disabled={loading}
              />
              {isAppleAvailable ? (
                <AuthProviderButton
                  icon="logo-apple"
                  label="Apple"
                  onPress={handleAppleSignIn}
                  disabled={loading}
                />
              ) : (
                <AuthProviderButton icon="logo-apple" label="Apple" tone="muted" disabled />
              )}
            </View>

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
