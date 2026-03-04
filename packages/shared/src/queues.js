"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_JOB_OPTIONS = exports.QUEUE_NAMES = void 0;
exports.QUEUE_NAMES = {
    STT_PROCESSING: 'stt-processing',
    PHOTO_PARSING: 'photo-parsing',
    FOOD_INDEX_SYNC: 'food-index-sync',
    REMINDERS: 'reminders',
    WEBHOOK_RETRY: 'webhook-retry',
    DATA_EXPORT: 'data-export',
    ANALYTICS: 'analytics',
};
exports.DEFAULT_JOB_OPTIONS = {
    attempts: 3,
    backoff: {
        type: 'exponential',
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
//# sourceMappingURL=queues.js.map