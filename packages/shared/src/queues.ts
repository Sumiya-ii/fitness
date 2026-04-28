export const QUEUE_NAMES = {
  PHOTO_PARSING: 'photo-parsing',
  REMINDERS: 'reminders',
  COACH_MEMORY: 'coach-memory',
  PRIVACY: 'privacy',
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
