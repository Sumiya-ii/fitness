import type { OnboardingStackParamList } from '../../navigation/types';

type RouteName = keyof OnboardingStackParamList;

type StepDef = {
  route: RouteName;
  includeInProgress: boolean;
};

export const ONBOARDING_STEPS: StepDef[] = [
  { route: 'Welcome', includeInProgress: false },
  { route: 'GoalSetup', includeInProgress: true },
  { route: 'GenderSelect', includeInProgress: true },
  { route: 'BirthDateSelect', includeInProgress: true },
  { route: 'HeightSelect', includeInProgress: true },
  { route: 'WeightSelect', includeInProgress: true },
  { route: 'DesiredWeight', includeInProgress: true },
  { route: 'WeeklyRate', includeInProgress: true },
  { route: 'ActivityLevelSelect', includeInProgress: true },
  { route: 'DietPreferenceSelect', includeInProgress: true },
  { route: 'Motivation', includeInProgress: true },
  { route: 'GeneratingPlan', includeInProgress: false },
  { route: 'TargetReview', includeInProgress: false },
  { route: 'SignUp', includeInProgress: false },
  { route: 'SignIn', includeInProgress: false },
  { route: 'ForgotPassword', includeInProgress: false },
  { route: 'SubscriptionPitch', includeInProgress: false },
  { route: 'ConnectTelegram', includeInProgress: false },
  { route: 'NotificationPermission', includeInProgress: false },
];

const PROGRESS_ROUTES = ONBOARDING_STEPS.filter((s) => s.includeInProgress).map((s) => s.route);
const PROGRESS_TOTAL = PROGRESS_ROUTES.length;

export type ProgressInfo = { step: number; total: number; percent: number };

export function getProgress(route: RouteName): ProgressInfo | null {
  const idx = PROGRESS_ROUTES.indexOf(route);
  if (idx === -1) return null;
  const step = idx + 1;
  return { step, total: PROGRESS_TOTAL, percent: step / PROGRESS_TOTAL };
}
