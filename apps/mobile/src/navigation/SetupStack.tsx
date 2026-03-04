import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { SetupStackParamList } from './types';
import {
  GoalSetupScreen,
  ProfileSetupScreen,
  TargetReviewScreen,
} from '../screens/onboarding';

const Stack = createNativeStackNavigator<SetupStackParamList>();

export function SetupStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="GoalSetup" component={GoalSetupScreen} />
      <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
      <Stack.Screen name="TargetReview" component={TargetReviewScreen} />
    </Stack.Navigator>
  );
}
