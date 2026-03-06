import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuthStore } from '../stores/auth.store';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

export function SignUpScreen({ navigation }: Props) {
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
        colors={['#f4f4f7', '#ececf2', '#f4f4f7']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="absolute inset-0"
      />
      <View className="flex-1 px-6 pt-4">
        <Pressable
          onPress={() => navigation.goBack()}
          className="absolute top-4 left-6 z-10 p-2 -m-2"
        >
          <Ionicons name="arrow-back" size={24} color="#9a9caa" />
        </Pressable>
        <Text className="text-2xl font-sans-bold text-text mb-1 mt-10">
          Create Account
        </Text>
        <Text className="text-base text-text-secondary mb-6">
          Join Coach and start your nutrition journey.
        </Text>

        <View className="rounded-3xl bg-surface-card border border-surface-border p-4 mb-6">
          <Input
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            containerClassName="mb-4"
          />

          <Input
            label="Password"
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
                  color="#9a9caa"
                />
              </Pressable>
            }
            containerClassName="mb-4"
          />

          <Input
            label="Confirm Password"
            placeholder="••••••••"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            error={confirmPassword && !passwordsMatch ? 'Passwords do not match' : undefined}
            containerClassName="mb-4"
          />

          <Pressable
            onPress={() => setAcceptedTerms(!acceptedTerms)}
            className="flex-row items-center mb-6"
          >
            <View
              className={`w-5 h-5 rounded border-2 mr-3 items-center justify-center ${
                acceptedTerms ? 'bg-primary-500 border-primary-500' : 'border-surface-border'
              }`}
            >
              {acceptedTerms && <Ionicons name="checkmark" size={14} color="white" />}
            </View>
            <Text className="flex-1 text-sm text-text-secondary">
              I agree to the{' '}
              <Text className="text-primary-400">Terms of Service</Text>
              {' '}and{' '}
              <Text className="text-primary-400">Privacy Policy</Text>
            </Text>
          </Pressable>

          <Button
            onPress={handleCreateAccount}
            size="lg"
            loading={loading}
            disabled={!isValid}
            className="w-full mb-6"
          >
            Create Account
          </Button>

          {error ? (
            <Text className="text-sm text-red-400 mb-4">{error}</Text>
          ) : null}
        </View>

        <View className="flex-row items-center gap-4 mb-6">
          <View className="flex-1 h-px bg-surface-secondary" />
          <Text className="text-sm text-text-tertiary">
            or sign up with
          </Text>
          <View className="flex-1 h-px bg-surface-secondary" />
        </View>

        <View className="flex-row gap-3 mb-8">
          <Pressable
            className="flex-1 flex-row items-center justify-center py-3 rounded-xl border border-surface-border bg-surface-card active:opacity-80"
          >
            <Ionicons name="logo-google" size={20} color="#9a9caa" />
            <Text className="ml-2 font-sans-medium text-text-secondary">
              Google
            </Text>
          </Pressable>
          <Pressable
            className="flex-1 flex-row items-center justify-center py-3 rounded-xl border border-surface-border bg-surface-muted active:opacity-80"
          >
            <Ionicons name="logo-apple" size={20} color="white" />
            <Text className="ml-2 font-sans-medium text-text">Apple</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => navigation.navigate('SignIn')}
          className="self-center py-2 active:opacity-70"
        >
          <Text className="text-base text-text-secondary">
            Already have an account?{' '}
            <Text className="text-primary-400 font-sans-semibold">
              Sign In
            </Text>
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
