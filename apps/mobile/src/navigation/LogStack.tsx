import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { LogStackParamList } from './types';
import {
  LogScreen,
  TextSearchScreen,
  QuickAddScreen,
  BarcodeScanScreen,
  BarcodeSubmitScreen,
  VoiceLogScreen,
  PhotoLogScreen,
  FavoritesRecentsScreen,
  MealTemplatesScreen,
  SaveTemplateScreen,
  LogTemplateScreen,
} from '../screens/logging';

const Stack = createNativeStackNavigator<LogStackParamList>();

export function LogStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
      }}
    >
      <Stack.Screen name="LogHome" component={LogScreen} />
      <Stack.Screen name="TextSearch" component={TextSearchScreen} />
      <Stack.Screen name="QuickAdd" component={QuickAddScreen} />
      <Stack.Screen name="BarcodeScan" component={BarcodeScanScreen} />
      <Stack.Screen name="BarcodeSubmit" component={BarcodeSubmitScreen} />
      <Stack.Screen name="VoiceLog" component={VoiceLogScreen} />
      <Stack.Screen name="PhotoLog" component={PhotoLogScreen} />
      <Stack.Screen name="FavoritesRecents" component={FavoritesRecentsScreen} />
      <Stack.Screen name="MealTemplates" component={MealTemplatesScreen} />
      <Stack.Screen name="SaveTemplate" component={SaveTemplateScreen} />
      <Stack.Screen name="LogTemplate" component={LogTemplateScreen} />
    </Stack.Navigator>
  );
}
