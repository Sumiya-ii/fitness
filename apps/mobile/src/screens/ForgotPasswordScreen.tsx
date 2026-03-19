import { useState } from 'react';
import { View, Text, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/types';
import { Button, Input } from '../components/ui';
import { useAuthStore } from '../stores/auth.store';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetPassword = useAuthStore((s) => s.resetPassword);

  const handleSend = async () => {
    if (!email.trim()) return;
    setError(null);
    setLoading(true);
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset email.');
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
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-1 px-6 pt-4">
            <Pressable onPress={() => navigation.goBack()} hitSlop={12} className="mb-8 self-start">
              <Ionicons name="arrow-back" size={24} color="#0f172a" />
            </Pressable>

            {sent ? (
              /* Success state */
              <View className="flex-1 items-center justify-center pb-20">
                <View className="h-20 w-20 rounded-full bg-green-100 items-center justify-center mb-6">
                  <Ionicons name="mail-outline" size={36} color="#22c55e" />
                </View>
                <Text className="text-2xl font-sans-bold text-text mb-3 text-center">
                  Check your email
                </Text>
                <Text className="text-base text-text-secondary text-center px-4 mb-8">
                  We sent a password reset link to{' '}
                  <Text className="font-sans-semibold text-text">{email}</Text>
                </Text>
                <Pressable
                  onPress={() => navigation.navigate('SignIn')}
                  className="active:opacity-70"
                >
                  <Text className="text-base text-primary-600 font-sans-semibold">
                    Back to Sign In
                  </Text>
                </Pressable>
              </View>
            ) : (
              /* Form state */
              <>
                <Text className="text-3xl font-sans-bold text-text mb-2">Reset password</Text>
                <Text className="text-base text-text-secondary mb-8">
                  Enter your email and we'll send you a link to reset your password.
                </Text>

                <Input
                  label="Email"
                  placeholder="you@example.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  returnKeyType="go"
                  onSubmitEditing={handleSend}
                  containerClassName="mb-6"
                  editable={!loading}
                />

                {error ? (
                  <View className="flex-row items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-4">
                    <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
                    <Text className="text-sm text-red-500 flex-1">{error}</Text>
                  </View>
                ) : null}

                <Button
                  onPress={handleSend}
                  size="lg"
                  loading={loading}
                  disabled={!email.trim() || loading}
                  className="w-full"
                >
                  Send Reset Link
                </Button>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
