import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { MainStackParamList } from './types';
import { MainTabs } from './MainTabs';
import { TelegramConnectScreen } from '../screens/TelegramConnectScreen';
import { SubscriptionScreen } from '../screens/SubscriptionScreen';
import { EditProfileScreen } from '../screens/EditProfileScreen';
import { PersonalDetailsScreen } from '../screens/PersonalDetailsScreen';
import { AppSettingsScreen } from '../screens/AppSettingsScreen';
import { RemindersScreen } from '../screens/RemindersScreen';
import { RingColorsExplainedScreen } from '../screens/RingColorsExplainedScreen';
import { EditTargetsScreen } from '../screens/settings/EditTargetsScreen';

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
    </Stack.Navigator>
  );
}
