import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { MainStackParamList } from './types';
import { MainTabs } from './MainTabs';
import { WeeklySummaryScreen } from '../screens/WeeklySummaryScreen';
import { TelegramConnectScreen } from '../screens/TelegramConnectScreen';
import { SubscriptionScreen } from '../screens/SubscriptionScreen';

const Stack = createNativeStackNavigator<MainStackParamList>();

export function MainStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="WeeklySummary" component={WeeklySummaryScreen} />
      <Stack.Screen name="TelegramConnect" component={TelegramConnectScreen} />
      <Stack.Screen name="Subscription" component={SubscriptionScreen} />
    </Stack.Navigator>
  );
}
