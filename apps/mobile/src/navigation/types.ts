import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Onboarding: undefined;
  Welcome: undefined;
  SignIn: undefined;
  SignUp: undefined;
};

export type SetupStackParamList = {
  GoalSetup: undefined;
  ProfileSetup: undefined;
  TargetReview: undefined;
};

export type LogStackParamList = {
  LogHome: undefined;
  TextSearch: undefined;
  QuickAdd: undefined;
  BarcodeScan: undefined;
  BarcodeSubmit: { barcode: string };
  VoiceLog: undefined;
  PhotoLog: undefined;
  FavoritesRecents: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Log: undefined;
  Search: undefined;
  Progress: undefined;
  Settings: undefined;
};

export type MainStackParamList = {
  MainTabs: undefined;
  WeeklySummary: undefined;
  TelegramConnect: undefined;
  Subscription: undefined;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Setup: NavigatorScreenParams<SetupStackParamList>;
  Main: NavigatorScreenParams<MainStackParamList>;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
    interface AuthParamList extends AuthStackParamList {}
    interface SetupParamList extends SetupStackParamList {}
    interface MainParamList extends MainStackParamList {}
    interface LogParamList extends LogStackParamList {}
  }
}

export type LogStackScreenProps<T extends keyof LogStackParamList> = {
  navigation: import('@react-navigation/native').CompositeNavigationProp<
    import('@react-navigation/native-stack').NativeStackNavigationProp<LogStackParamList, T>,
    import('@react-navigation/bottom-tabs').BottomTabNavigationProp<MainTabParamList, 'Log'>
  >;
  route: import('@react-navigation/native').RouteProp<LogStackParamList, T>;
};
