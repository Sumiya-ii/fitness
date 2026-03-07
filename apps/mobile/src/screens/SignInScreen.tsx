import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/types';
import { AuthProviderButton, Button, Card, IconButton, Input } from '../components/ui';
import { useAuthStore } from '../stores/auth.store';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;

export function SignInScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useAuthStore((s) => s.signIn);

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
        colors={['#f4f4f7', '#ececf2', '#f4f4f7']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="absolute inset-0"
      />
      <View className="flex-1 px-6 pt-4">
        <Pressable
          onPress={() => navigation.goBack()}
          className="absolute top-4 left-6 z-10"
        >
          <IconButton icon="arrow-back" />
        </Pressable>
        <Text className="text-2xl font-sans-bold text-text mb-1 mt-10">
          Sign In
        </Text>
        <Text className="text-base text-text-secondary mb-8">
          Welcome back! Enter your credentials to continue.
        </Text>

        <Card className="rounded-3xl p-4 mb-6">
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
            autoComplete="password"
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
            containerClassName="mb-6"
          />

          <Button
            onPress={handleSignIn}
            size="lg"
            loading={loading}
            disabled={!email || !password}
            className="w-full mb-6"
          >
            Sign In
          </Button>

          {error ? (
            <Text className="text-sm text-red-400 mb-4">{error}</Text>
          ) : null}
        </Card>

        <View className="flex-row items-center gap-4 mb-6">
          <View className="flex-1 h-px bg-surface-secondary" />
          <Text className="text-sm text-text-tertiary">
            or continue with
          </Text>
          <View className="flex-1 h-px bg-surface-secondary" />
        </View>

        <View className="flex-row gap-3 mb-8">
          <AuthProviderButton icon="logo-google" label="Google" />
          <AuthProviderButton icon="logo-apple" label="Apple" tone="muted" />
        </View>

        <Pressable
          onPress={() => navigation.navigate('SignUp')}
          className="self-center py-2 active:opacity-70"
        >
          <Text className="text-base text-text-secondary">
            Don't have an account?{' '}
            <Text className="text-primary-600 font-sans-semibold">
              Sign Up
            </Text>
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
