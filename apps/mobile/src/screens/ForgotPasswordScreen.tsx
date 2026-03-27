import { useState } from 'react';
import { View, Text, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/types';
import { Button, Input } from '../components/ui';
import { resetPassword } from '../services/firebase-auth.service';
import { useLocale } from '../i18n';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation }: Props) {
  const { t } = useLocale();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setError(null);
    setLoading(true);
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
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
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-1 px-6 pt-4">
            <Pressable onPress={() => navigation.goBack()} hitSlop={12} className="mb-8 self-start">
              <Ionicons name="arrow-back" size={24} color="#ffffff" />
            </Pressable>

            <Text className="text-3xl font-sans-bold text-text mb-1">
              {t('auth.resetPassword')}
            </Text>
            <Text className="text-base text-text-secondary mb-8">
              {t('auth.resetPasswordDesc')}
            </Text>

            {sent ? (
              <View className="flex-row items-start gap-3 bg-green-50 border border-green-200 rounded-2xl px-4 py-4 mb-6">
                <Ionicons name="checkmark-circle-outline" size={20} color="#22c55e" />
                <Text className="text-sm text-green-700 flex-1 leading-5">
                  {`${t('auth.checkInbox')} ${email.trim()}.`}
                </Text>
              </View>
            ) : (
              <>
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
                />

                {error ? (
                  <View className="flex-row items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-4">
                    <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
                    <Text className="text-sm text-red-500 flex-1">{error}</Text>
                  </View>
                ) : null}

                <Button
                  onPress={handleSubmit}
                  size="lg"
                  loading={loading}
                  disabled={!email.trim() || loading}
                  className="w-full"
                >
                  {t('auth.sendResetLink')}
                </Button>
              </>
            )}

            {sent && (
              <Button
                onPress={() => navigation.navigate('SignIn')}
                variant="outline"
                size="lg"
                className="w-full mt-4"
              >
                {t('auth.backToSignIn')}
              </Button>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
