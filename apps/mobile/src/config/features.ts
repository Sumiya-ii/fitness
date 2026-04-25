// Feature flags for MVP v1 App Store submission.
// Default ON (MVP_V1 = true) so prod builds are locked to MVP scope.
// Set EXPO_PUBLIC_MVP_V1=false in a dev/staging env to unlock everything.
const MVP_V1 = process.env.EXPO_PUBLIC_MVP_V1 !== 'false';

export const features = {
  voiceLoggingInApp: !MVP_V1, // voice happens via Telegram only in v1
  aiChatInApp: !MVP_V1, // chat happens via Telegram only in v1
  workouts: !MVP_V1, // hide for v1
  bodyComposition: !MVP_V1, // hide for v1
  weeklySummary: !MVP_V1, // hide for v1
  mealNudgeSettings: !MVP_V1, // hide nudge toggles in v1
};
