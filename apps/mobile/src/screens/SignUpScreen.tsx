import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  const signIn = useAuthStore((s) => s.signIn);

  const passwordsMatch = password === confirmPassword;
  const isValid =
    email &&
    password &&
    confirmPassword &&
    passwordsMatch &&
    acceptedTerms;

  const handleCreateAccount = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      // TODO: Wire to auth API - for now simulate success
      await signIn('placeholder-token');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-slate-900">
      <View className="flex-1 px-6 pt-4">
        <Pressable
          onPress={() => navigation.goBack()}
          className="absolute top-4 left-6 z-10 p-2 -m-2"
        >
          <Ionicons name="arrow-back" size={24} color="#64748b" />
        </Pressable>
        <Text className="text-2xl font-sans-bold text-text mb-1 mt-10 dark:text-slate-100">
          Create Account
        </Text>
        <Text className="text-base text-text-secondary mb-6 dark:text-slate-400">
          Join Coach and start your nutrition journey.
        </Text>

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
                color="#64748b"
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
              acceptedTerms ? 'bg-primary-500 border-primary-500' : 'border-slate-300 dark:border-slate-600'
            }`}
          >
            {acceptedTerms && <Ionicons name="checkmark" size={14} color="white" />}
          </View>
          <Text className="flex-1 text-sm text-text-secondary dark:text-slate-400">
            I agree to the{' '}
            <Text className="text-primary-600 dark:text-primary-400">Terms of Service</Text>
            {' '}and{' '}
            <Text className="text-primary-600 dark:text-primary-400">Privacy Policy</Text>
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

        <View className="flex-row items-center gap-4 mb-6">
          <View className="flex-1 h-px bg-slate-200 dark:bg-slate-600" />
          <Text className="text-sm text-text-tertiary dark:text-slate-500">
            or sign up with
          </Text>
          <View className="flex-1 h-px bg-slate-200 dark:bg-slate-600" />
        </View>

        <View className="flex-row gap-3 mb-8">
          <Pressable
            className="flex-1 flex-row items-center justify-center py-3 rounded-xl border-2 border-slate-200 dark:border-slate-600 active:opacity-80"
          >
            <Ionicons name="logo-google" size={20} color="#64748b" />
            <Text className="ml-2 font-sans-medium text-text dark:text-slate-200">
              Google
            </Text>
          </Pressable>
          <Pressable
            className="flex-1 flex-row items-center justify-center py-3 rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-black active:opacity-80"
          >
            <Ionicons name="logo-apple" size={20} color="white" />
            <Text className="ml-2 font-sans-medium text-white">Apple</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => navigation.navigate('SignIn')}
          className="self-center py-2 active:opacity-70"
        >
          <Text className="text-base text-text-secondary dark:text-slate-400">
            Already have an account?{' '}
            <Text className="text-primary-600 font-sans-semibold dark:text-primary-400">
              Sign In
            </Text>
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
