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

export type MainTabParamList = {
  Home: undefined;
  Log: undefined;
  Search: undefined;
  Progress: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Setup: NavigatorScreenParams<SetupStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
    interface AuthParamList extends AuthStackParamList {}
    interface SetupParamList extends SetupStackParamList {}
    interface MainParamList extends MainTabParamList {}
  }
}
