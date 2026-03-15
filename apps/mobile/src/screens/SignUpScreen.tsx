import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/types';
import { AuthProviderButton, Button, Card, IconButton, Input } from '../components/ui';
import { useAuthStore } from '../stores/auth.store';
import { useLocale } from '../i18n';
import { themeColors } from '../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

export function SignUpScreen({ navigation }: Props) {
  const { t } = useLocale();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signUp = useAuthStore((s) => s.signUp);

  const passwordsMatch = password === confirmPassword;
  const isValid =
    email &&
    password &&
    confirmPassword &&
    passwordsMatch &&
    acceptedTerms;

  const handleCreateAccount = async () => {
    if (!isValid) return;
    setError(null);
    setLoading(true);
    try {
      await signUp(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account.');
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
            <Pressable
              onPress={() => navigation.goBack()}
              className="absolute top-4 left-6 z-10"
            >
              <IconButton icon="arrow-back" />
            </Pressable>
            <Text className="text-3xl font-sans-bold text-text mb-1 mt-10">
              {t('auth.signUp')}
            </Text>
            <Text className="text-base text-text-secondary mb-6">
              {t('auth.createAccountDesc')}
            </Text>

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
                autoComplete="new-password"
                rightIcon={
                  <Pressable
                    onPress={() => setShowPassword(!showPassword)}
                    hitSlop={12}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={22}
                      color="#7687a2"
                    />
                  </Pressable>
                }
                containerClassName="mb-4"
              />

              <Input
                label={t('auth.confirmPassword')}
                placeholder="••••••••"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                error={confirmPassword && !passwordsMatch ? t('auth.passwordsDoNotMatch') : undefined}
                containerClassName="mb-4"
              />

              <Pressable
                onPress={() => setAcceptedTerms(!acceptedTerms)}
                className="flex-row items-center mb-6"
              >
                <View
                  className={`w-5 h-5 rounded border-2 mr-3 items-center justify-center ${
                    acceptedTerms ? 'bg-primary-500 border-primary-500' : 'border-surface-border bg-surface-default'
                  }`}
                >
                  {acceptedTerms && <Ionicons name="checkmark" size={14} color="white" />}
                </View>
                <Text className="flex-1 text-sm text-text-secondary">
                  {t('auth.agreePrefix')}{' '}
                  <Text className="text-primary-600">{t('auth.termsOfService')}</Text>
                  {' '}{t('auth.and')}{' '}
                  <Text className="text-primary-600">{t('auth.privacyPolicy')}</Text>
                </Text>
              </Pressable>

              <Button
                onPress={handleCreateAccount}
                size="lg"
                loading={loading}
                disabled={!isValid}
                className="w-full mb-6"
              >
                {t('auth.signUp')}
              </Button>

              {error ? (
                <Text className="text-sm text-red-400 mb-4">{error}</Text>
              ) : null}
            </Card>

            <View className="flex-row items-center gap-4 mb-6">
              <View className="flex-1 h-px bg-surface-secondary" />
              <Text className="text-sm text-text-tertiary font-sans-medium">
                {t('auth.orSignUpWith')}
              </Text>
              <View className="flex-1 h-px bg-surface-secondary" />
            </View>

            <View className="flex-row gap-3 mb-8">
              <AuthProviderButton icon="logo-google" label="Google" />
              <AuthProviderButton icon="logo-apple" label="Apple" tone="muted" />
            </View>

            <Pressable
              onPress={() => navigation.navigate('SignIn')}
              className="self-center py-2 active:opacity-70"
            >
              <Text className="text-base text-text-secondary">
                {t('auth.haveAccount')}{' '}
                <Text className="text-primary-600 font-sans-semibold">
                  {t('auth.signIn')}
                </Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
