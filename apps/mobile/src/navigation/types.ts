import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Onboarding: undefined;
  Welcome: undefined;
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
};

export type SetupStackParamList = {
  GoalSetup: undefined;
  DesiredWeight: undefined;
  WeeklyRate: undefined;
  GenderSelect: undefined;
  BirthDateSelect: undefined;
  HeightSelect: undefined;
  WeightSelect: undefined;
  ActivityLevelSelect: undefined;
  DietPreferenceSelect: undefined;
  Motivation: undefined;
  TargetReview: undefined;
  SubscriptionPitch: undefined;
  NotificationPermission: undefined;
};

export type LogStackParamList = {
  LogHome: undefined;
  TextSearch: { initialQuery?: string } | undefined;
  QuickAdd: undefined;
  BarcodeScan: undefined;
  BarcodeSubmit: { barcode: string };
  VoiceLog: undefined;
  PhotoLog: { mode?: 'food' | 'label' } | undefined;
  FavoritesRecents: undefined;
  MealTemplates: undefined;
  SaveTemplate: { mealLogId: string; mealType?: string; itemNames: string[] };
  LogTemplate: { templateId: string };
};

export type MainTabParamList = {
  Home: undefined;
  Log: NavigatorScreenParams<LogStackParamList> | undefined;
  Progress: undefined;
  Settings: undefined;
};

export type MainStackParamList = {
  MainTabs: undefined;
  WeeklySummary: undefined;
  TelegramConnect: undefined;
  Subscription: undefined;
  CoachChat: undefined;
  EditProfile: undefined;
  PersonalDetails: undefined;
  AppSettings: undefined;
  Reminders: undefined;
  WorkoutHome: undefined;
  WorkoutTypePicker: { category?: string } | undefined;
  WorkoutActive: { workoutType: string };
  WorkoutHistory: undefined;
  WorkoutDetail: { id: string };
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Setup: NavigatorScreenParams<SetupStackParamList>;
  Main: NavigatorScreenParams<MainStackParamList>;
};

declare global {
  // React Navigation relies on this namespace augmentation for route type inference.
  // eslint-disable-next-line @typescript-eslint/no-namespace
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
