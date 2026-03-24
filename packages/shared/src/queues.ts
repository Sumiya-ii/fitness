export const QUEUE_NAMES = {
  STT_PROCESSING: 'stt-processing',
  PHOTO_PARSING: 'photo-parsing',
  FOOD_INDEX_SYNC: 'food-index-sync',
  REMINDERS: 'reminders',
  COACH_MESSAGES: 'coach-messages',
  WEEKLY_REPORT: 'weekly-report',
  WEBHOOK_RETRY: 'webhook-retry',
  DATA_EXPORT: 'data-export',
  ANALYTICS: 'analytics',
  ADAPTIVE_TARGET: 'adaptive-target',
  MEAL_TIMING_INSIGHTS: 'meal-timing-insights',
  COACH_MEMORY: 'coach-memory',
  MEAL_NUDGE: 'meal-nudge',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 1000,
  },
  removeOnComplete: {
    age: 24 * 60 * 60, // 24 hours
    count: 1000,
  },
  removeOnFail: {
    age: 7 * 24 * 60 * 60, // 7 days (keep for debugging)
  },
};
