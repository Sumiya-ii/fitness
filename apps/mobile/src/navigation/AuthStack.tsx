import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AuthStackParamList } from './types';
import { OnboardingScreen } from '../screens/onboarding';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { SignInScreen } from '../screens/SignInScreen';
import { SignUpScreen } from '../screens/SignUpScreen';
import { useOnboardingStore } from '../stores/onboarding.store';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthStack() {
  const onboardingComplete = useOnboardingStore((s) => s.onboardingComplete);

  return (
    <Stack.Navigator
      initialRouteName={onboardingComplete ? 'Welcome' : 'Onboarding'}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
    </Stack.Navigator>
  );
}
