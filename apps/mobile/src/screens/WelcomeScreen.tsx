import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/types';
import { Button } from '../components/ui/Button';
import { useAuthStore } from '../stores/auth.store';
import { useOnboardingStore } from '../stores/onboarding.store';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  const signInWithToken = useAuthStore((s) => s.signInWithToken);
  const setProfileSetupComplete = useOnboardingStore((s) => s.setProfileSetupComplete);

  const handleContinueAsGuest = async () => {
    await setProfileSetupComplete();
    await signInWithToken('guest-token', { id: 'guest', email: null });
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-app">
      <LinearGradient
        colors={['#f4f4f7', '#ececf2', '#f4f4f7']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="absolute inset-0"
      />
      <View className="flex-1 justify-center items-center px-8">
        <View className="items-center mb-12">
          <LinearGradient
            colors={['#1f2028', '#15161d']}
            className="px-8 py-4 rounded-2xl mb-5"
            style={{ borderRadius: 16 }}
          >
            <Text className="text-4xl font-sans-bold text-text">Coach</Text>
          </LinearGradient>
          <Text className="text-lg text-text-secondary text-center">
            Your AI nutrition companion
          </Text>
          <Text className="text-sm text-text-tertiary mt-2 text-center leading-5">
            Track meals, hit macros, and stay consistent with AI coaching.
          </Text>
        </View>

        <View className="w-full gap-3">
          <Button
            onPress={() => navigation.navigate('SignIn')}
            size="lg"
            className="w-full"
          >
            Sign In
          </Button>
          <Button
            onPress={() => navigation.navigate('SignUp')}
            variant="outline"
            size="lg"
            className="w-full"
          >
            Create Account
          </Button>
        </View>

        <Pressable
          onPress={handleContinueAsGuest}
          className="mt-8 py-2 px-3 rounded-full border border-surface-border bg-surface-card active:opacity-70 flex-row items-center gap-2"
        >
          <Ionicons name="person-outline" size={16} color="#2a2b35" />
          <Text className="text-base text-primary-400 font-sans-medium">
            Continue as Guest
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
