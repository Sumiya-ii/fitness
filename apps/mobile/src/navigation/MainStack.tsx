import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { MainStackParamList } from './types';
import { features } from '../config/features';
import { MainTabs } from './MainTabs';
import { TelegramConnectScreen } from '../screens/TelegramConnectScreen';
import { SubscriptionScreen } from '../screens/SubscriptionScreen';
import { EditProfileScreen } from '../screens/EditProfileScreen';
import { PersonalDetailsScreen } from '../screens/PersonalDetailsScreen';
import { AppSettingsScreen } from '../screens/AppSettingsScreen';
import { RemindersScreen } from '../screens/RemindersScreen';
import { RingColorsExplainedScreen } from '../screens/RingColorsExplainedScreen';
import { EditTargetsScreen } from '../screens/settings/EditTargetsScreen';
// Gated imports — loaded lazily via conditional rendering; kept for v1.1 re-enable
import { WeeklySummaryScreen } from '../screens/WeeklySummaryScreen';
import { CoachChatScreen } from '../screens/CoachChatScreen';
import {
  WorkoutHomeScreen,
  WorkoutTypePickerScreen,
  WorkoutActiveScreen,
  WorkoutHistoryScreen,
  WorkoutDetailScreen,
} from '../screens/workout';
import { BodyCompositionLogScreen } from '../screens/progress/BodyCompositionLogScreen';

const Stack = createNativeStackNavigator<MainStackParamList>();

export function MainStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="TelegramConnect" component={TelegramConnectScreen} />
      <Stack.Screen name="Subscription" component={SubscriptionScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="PersonalDetails" component={PersonalDetailsScreen} />
      <Stack.Screen name="AppSettings" component={AppSettingsScreen} />
      <Stack.Screen name="Reminders" component={RemindersScreen} />
      <Stack.Screen name="RingColorsExplained" component={RingColorsExplainedScreen} />
      <Stack.Screen
        name="EditTargets"
        component={EditTargetsScreen}
        options={{ presentation: 'modal' }}
      />
      {/* MVP v1 gated screens — re-enable in v1.1 by setting EXPO_PUBLIC_MVP_V1=false */}
      {features.weeklySummary && (
        <Stack.Screen name="WeeklySummary" component={WeeklySummaryScreen} />
      )}
      {features.aiChatInApp && <Stack.Screen name="CoachChat" component={CoachChatScreen} />}
      {features.workouts && (
        <>
          <Stack.Screen name="WorkoutHome" component={WorkoutHomeScreen} />
          <Stack.Screen name="WorkoutTypePicker" component={WorkoutTypePickerScreen} />
          <Stack.Screen name="WorkoutActive" component={WorkoutActiveScreen} />
          <Stack.Screen name="WorkoutHistory" component={WorkoutHistoryScreen} />
          <Stack.Screen name="WorkoutDetail" component={WorkoutDetailScreen} />
        </>
      )}
      {features.bodyComposition && (
        <Stack.Screen
          name="BodyCompositionLog"
          component={BodyCompositionLogScreen}
          options={{ presentation: 'modal' }}
        />
      )}
    </Stack.Navigator>
  );
}
