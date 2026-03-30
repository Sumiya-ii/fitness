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
  timezone: string;
}

/**
 * Valid time windows (in minutes from midnight) for each message type.
 * Used by the processor to reject stale/delayed jobs whose content
 * would no longer match the user's current time of day.
 */
export const MESSAGE_TIME_WINDOWS: Record<CoachMessageType, Array<[number, number]>> = {
  morning_greeting: [[7 * 60 + 30, 9 * 60 + 30]], // 7:30–9:30 (1h grace)
  water_reminder: [
    [10 * 60, 12 * 60],
    [15 * 60, 19 * 60],
  ],
  meal_nudge: [
    [11 * 60, 13 * 60],
    [18 * 60, 20 * 60],
  ],
  midday_checkin: [[12 * 60, 14 * 60]],
  progress_feedback: [[20 * 60, 22 * 60]],
  weekly_summary: [[9 * 60, 11 * 60]],
  streak_celebration: [[9 * 60, 11 * 60]],
};

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
