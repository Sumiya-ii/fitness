export type CoachMessageType =
  | 'morning_greeting'
  | 'water_reminder'
  | 'meal_nudge'
  | 'midday_checkin'
  | 'progress_feedback'
  | 'weekly_summary'
  | 'streak_celebration';

export interface CoachContext {
  userName: string | null;
  locale: 'mn' | 'en';
  today: {
    mealsLogged: number;
    caloriesConsumed: number;
    caloriesTarget: number | null;
    proteinConsumed: number;
    proteinTarget: number | null;
    carbsConsumed: number;
    fatConsumed: number;
    waterMl: number;
    waterTarget: number;
    mealTypes: string[];
  };
  streak: {
    mealLoggingDays: number;
    waterGoalDays: number;
  };
  weekly: {
    avgDailyCalories: number;
    avgMealsPerDay: number;
    daysWithWaterGoalMet: number;
    totalDays: number;
  };
  messageType: CoachMessageType;
  localTime: string;
}

export interface CoachJobData {
  userId: string;
  messageType: CoachMessageType;
  channels: string[];
  chatId?: string;
  locale?: string;
  pushTokens?: string[];
  context: CoachContext;
  memoryBlock?: string;
}

/** Cooldown durations in seconds per message type */
export const COACH_COOLDOWNS: Record<CoachMessageType, number> = {
  morning_greeting: 20 * 3600,
  water_reminder: 2.5 * 3600,
  meal_nudge: 3 * 3600,
  midday_checkin: 4 * 3600,
  progress_feedback: 20 * 3600,
  weekly_summary: 144 * 3600, // 6 days
  streak_celebration: 20 * 3600,
};

/** Max proactive messages per user per day */
export const DAILY_MESSAGE_CAP = 4;
