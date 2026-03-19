import { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/types';
import { useAuthStore } from '../stores/auth.store';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  const signInWithGoogleStore = useAuthStore((s) => s.signInWithGoogle);
  const signInWithAppleStore = useAuthStore((s) => s.signInWithApple);
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);
  const [loading, setLoading] = useState<'google' | 'apple' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setIsAppleAvailable);
  }, []);

  const handleGoogle = async () => {
    setError(null);
    setLoading('google');
    try {
      await signInWithGoogleStore();
    } catch (err) {
      if (err instanceof Error && err.message !== 'CANCELLED') {
        setError(err.message);
      }
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
      if (err instanceof Error && err.message !== 'CANCELLED') {
        setError(err.message);
      }
    } finally {
      setLoading(null);
    }
  };

  const isLoading = loading !== null;

  return (
    <SafeAreaView className="flex-1 bg-surface-app">
      <LinearGradient
        colors={['#f4f7fb', '#eef2f9', '#f4f7fb']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="absolute inset-0"
      />

      {/* Hero */}
      <View className="flex-1 items-center justify-center px-6">
        <View
          className="h-20 w-20 rounded-3xl items-center justify-center mb-6"
          style={{ backgroundColor: '#0f172a' }}
        >
          <Ionicons name="sparkles" size={34} color="#ffffff" />
        </View>
        <Text className="text-4xl font-sans-bold text-text tracking-tight">Coach</Text>
        <Text className="text-base text-text-secondary mt-2 text-center">
          Your AI nutrition companion
        </Text>
        <Text className="text-sm text-text-tertiary mt-1 text-center">
          Track meals · Hit macros · Stay consistent
        </Text>
      </View>

      {/* Auth actions */}
      <View className="px-6 pb-6 gap-3">
        {error ? (
          <View className="flex-row items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
            <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
            <Text className="text-sm text-red-500 flex-1">{error}</Text>
          </View>
        ) : null}

        {/* Google */}
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
                Continue with Google
              </Text>
            </>
          )}
        </Pressable>

        {/* Apple (only on iOS when available) */}
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
                  Continue with Apple
                </Text>
              </>
            )}
          </Pressable>
        )}

        {/* Divider */}
        <View className="flex-row items-center gap-4 my-1">
          <View className="flex-1 h-px bg-surface-secondary" />
          <Text className="text-xs text-text-tertiary font-sans-medium">
            or continue with email
          </Text>
          <View className="flex-1 h-px bg-surface-secondary" />
        </View>

        {/* Email options */}
        <Pressable
          onPress={() => navigation.navigate('SignIn')}
          disabled={isLoading}
          className="border border-surface-border rounded-2xl py-4 items-center active:opacity-80"
        >
          <Text className="text-base font-sans-semibold text-text">Sign In</Text>
        </Pressable>

        <Pressable
          onPress={() => navigation.navigate('SignUp')}
          disabled={isLoading}
          className="py-3 items-center active:opacity-70"
        >
          <Text className="text-sm text-text-secondary">
            New here? <Text className="text-primary-600 font-sans-semibold">Create an account</Text>
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
