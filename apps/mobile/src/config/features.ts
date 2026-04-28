// Feature flags for MVP v1 App Store submission.
// By default, expose the built product surface. Set EXPO_PUBLIC_MVP_V1=true
// only when intentionally cutting down the app for a narrower release review.
const MVP_V1 = process.env.EXPO_PUBLIC_MVP_V1 === 'true';

export const features = {
  voiceLoggingInApp: !MVP_V1, // voice happens via Telegram only in v1
  aiChatInApp: !MVP_V1, // chat happens via Telegram only in v1
  workouts: !MVP_V1, // hide for v1
  bodyComposition: !MVP_V1, // hide for v1
  weeklySummary: !MVP_V1, // hide for v1
  mealNudgeSettings: !MVP_V1, // hide nudge toggles in v1
};
