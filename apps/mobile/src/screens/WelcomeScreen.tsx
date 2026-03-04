import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/types';
import { Button } from '../components/ui/Button';
import { useAuthStore } from '../stores/auth.store';
import { useOnboardingStore } from '../stores/onboarding.store';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  const signIn = useAuthStore((s) => s.signIn);
  const setProfileSetupComplete = useOnboardingStore((s) => s.setProfileSetupComplete);

  const handleContinueAsGuest = async () => {
    await setProfileSetupComplete();
    await signIn('guest-token');
  };

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-slate-900">
      <View className="flex-1 justify-center items-center px-8">
        <View className="items-center mb-12">
          <LinearGradient
            colors={['#22c55e', '#16a34a']}
            className="px-8 py-4 rounded-2xl"
            style={{ borderRadius: 16 }}
          >
            <Text className="text-4xl font-sans-bold text-white">Coach</Text>
          </LinearGradient>
          <Text className="text-lg text-text-secondary mt-4 text-center dark:text-slate-400">
            Your AI nutrition companion
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
          className="mt-8 py-2 active:opacity-70"
        >
          <Text className="text-base text-primary-600 font-sans-medium dark:text-primary-400">
            Continue as Guest
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
