import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  SignIn: undefined;
  ForgotPassword: undefined;
};

export type OnboardingStackParamList = {
  Welcome: undefined;
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
  GeneratingPlan: undefined;
  TargetReview: undefined;
  SignUp: undefined;
  SignIn: undefined;
  ForgotPassword: undefined;
  SubscriptionPitch: undefined;
  ConnectTelegram: undefined;
  NotificationPermission: undefined;
};

export type LogStackParamList = {
  LogHome: undefined;
  TextSearch: { initialQuery?: string } | undefined;
  QuickAdd: undefined;
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
  // WeeklySummary: gated behind features.weeklySummary (MVP v1 off)
  WeeklySummary: undefined;
  TelegramConnect: undefined;
  Subscription: undefined;
  // CoachChat: gated behind features.aiChatInApp (MVP v1 off) — screen file kept for v1.1
  CoachChat: undefined;
  EditProfile: undefined;
  PersonalDetails: undefined;
  AppSettings: undefined;
  Reminders: undefined;
  RingColorsExplained: undefined;
  // Workout screens: gated behind features.workouts (MVP v1 off)
  WorkoutHome: undefined;
  WorkoutTypePicker: { category?: string } | undefined;
  WorkoutActive: { workoutType: string };
  WorkoutHistory: undefined;
  WorkoutDetail: { id: string };
  EditTargets: undefined;
  // BodyCompositionLog: gated behind features.bodyComposition (MVP v1 off)
  BodyCompositionLog: undefined;
};

export type RootStackParamList = {
  Onboarding: NavigatorScreenParams<OnboardingStackParamList>;
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainStackParamList>;
};

declare global {
  // React Navigation relies on this namespace augmentation for route type inference.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
    interface OnboardingParamList extends OnboardingStackParamList {}
    interface AuthParamList extends AuthStackParamList {}
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
