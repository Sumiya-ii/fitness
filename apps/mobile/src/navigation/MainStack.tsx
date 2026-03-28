import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { MainStackParamList } from './types';
import { MainTabs } from './MainTabs';
import { WeeklySummaryScreen } from '../screens/WeeklySummaryScreen';
import { TelegramConnectScreen } from '../screens/TelegramConnectScreen';
import { SubscriptionScreen } from '../screens/SubscriptionScreen';
import { CoachChatScreen } from '../screens/CoachChatScreen';
import { EditProfileScreen } from '../screens/EditProfileScreen';
import { PersonalDetailsScreen } from '../screens/PersonalDetailsScreen';
import { AppSettingsScreen } from '../screens/AppSettingsScreen';
import { RemindersScreen } from '../screens/RemindersScreen';
import { RingColorsExplainedScreen } from '../screens/RingColorsExplainedScreen';
import {
  WorkoutHomeScreen,
  WorkoutTypePickerScreen,
  WorkoutActiveScreen,
  WorkoutHistoryScreen,
  WorkoutDetailScreen,
} from '../screens/workout';

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
      <Stack.Screen name="WeeklySummary" component={WeeklySummaryScreen} />
      <Stack.Screen name="TelegramConnect" component={TelegramConnectScreen} />
      <Stack.Screen name="Subscription" component={SubscriptionScreen} />
      <Stack.Screen name="CoachChat" component={CoachChatScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="PersonalDetails" component={PersonalDetailsScreen} />
      <Stack.Screen name="AppSettings" component={AppSettingsScreen} />
      <Stack.Screen name="Reminders" component={RemindersScreen} />
      <Stack.Screen name="RingColorsExplained" component={RingColorsExplainedScreen} />
      <Stack.Screen name="WorkoutHome" component={WorkoutHomeScreen} />
      <Stack.Screen name="WorkoutTypePicker" component={WorkoutTypePickerScreen} />
      <Stack.Screen name="WorkoutActive" component={WorkoutActiveScreen} />
      <Stack.Screen name="WorkoutHistory" component={WorkoutHistoryScreen} />
      <Stack.Screen name="WorkoutDetail" component={WorkoutDetailScreen} />
    </Stack.Navigator>
  );
}
