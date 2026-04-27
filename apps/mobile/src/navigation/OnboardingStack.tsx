import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from './types';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { SignUpScreen } from '../screens/SignUpScreen';
import { SignInScreen } from '../screens/SignInScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import {
  GoalSetupScreen,
  DesiredWeightScreen,
  WeeklyRateScreen,
  GenderSelectScreen,
  BirthDateSelectScreen,
  HeightSelectScreen,
  WeightSelectScreen,
  ActivityLevelSelectScreen,
  DietPreferenceSelectScreen,
  MotivationScreen,
  GeneratingPlanScreen,
  TargetReviewScreen,
  SubscriptionPitchScreen,
  ConnectTelegramScreen,
  NotificationPermissionScreen,
} from '../screens/onboarding';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export function OnboardingStack() {
  return (
    <Stack.Navigator
      initialRouteName="Welcome"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
      }}
    >
      <Stack.Screen
        name="Welcome"
        component={WelcomeScreen}
        options={{ animation: 'fade_from_bottom' }}
      />
      <Stack.Screen name="GoalSetup" component={GoalSetupScreen} />
      <Stack.Screen name="GenderSelect" component={GenderSelectScreen} />
      <Stack.Screen name="BirthDateSelect" component={BirthDateSelectScreen} />
      <Stack.Screen name="HeightSelect" component={HeightSelectScreen} />
      <Stack.Screen name="WeightSelect" component={WeightSelectScreen} />
      <Stack.Screen name="DesiredWeight" component={DesiredWeightScreen} />
      <Stack.Screen name="WeeklyRate" component={WeeklyRateScreen} />
      <Stack.Screen name="ActivityLevelSelect" component={ActivityLevelSelectScreen} />
      <Stack.Screen name="DietPreferenceSelect" component={DietPreferenceSelectScreen} />
      <Stack.Screen name="Motivation" component={MotivationScreen} />
      <Stack.Screen
        name="GeneratingPlan"
        component={GeneratingPlanScreen}
        options={{ gestureEnabled: false, animation: 'fade' }}
      />
      <Stack.Screen name="TargetReview" component={TargetReviewScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="SubscriptionPitch" component={SubscriptionPitchScreen} />
      <Stack.Screen name="ConnectTelegram" component={ConnectTelegramScreen} />
      <Stack.Screen
        name="NotificationPermission"
        component={NotificationPermissionScreen}
        options={{ gestureEnabled: false }}
      />
    </Stack.Navigator>
  );
}
