import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { SetupStackParamList } from './types';
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
  TargetReviewScreen,
} from '../screens/onboarding';

const Stack = createNativeStackNavigator<SetupStackParamList>();

export function SetupStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="GoalSetup" component={GoalSetupScreen} />
      <Stack.Screen name="DesiredWeight" component={DesiredWeightScreen} />
      <Stack.Screen name="WeeklyRate" component={WeeklyRateScreen} />
      <Stack.Screen name="GenderSelect" component={GenderSelectScreen} />
      <Stack.Screen name="BirthDateSelect" component={BirthDateSelectScreen} />
      <Stack.Screen name="HeightSelect" component={HeightSelectScreen} />
      <Stack.Screen name="WeightSelect" component={WeightSelectScreen} />
      <Stack.Screen name="ActivityLevelSelect" component={ActivityLevelSelectScreen} />
      <Stack.Screen name="DietPreferenceSelect" component={DietPreferenceSelectScreen} />
      <Stack.Screen name="Motivation" component={MotivationScreen} />
      <Stack.Screen name="TargetReview" component={TargetReviewScreen} />
    </Stack.Navigator>
  );
}
