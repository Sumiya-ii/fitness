export declare const QUEUE_NAMES: {
    readonly STT_PROCESSING: "stt-processing";
    readonly PHOTO_PARSING: "photo-parsing";
    readonly FOOD_INDEX_SYNC: "food-index-sync";
    readonly REMINDERS: "reminders";
    readonly WEBHOOK_RETRY: "webhook-retry";
    readonly DATA_EXPORT: "data-export";
    readonly ANALYTICS: "analytics";
};
export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
export declare const DEFAULT_JOB_OPTIONS: {
    attempts: number;
    backoff: {
        type: "exponential";
        delay: number;
    };
    removeOnComplete: {
        age: number;
        count: number;
    };
    removeOnFail: {
        age: number;
    };
};
//# sourceMappingURL=queues.d.ts.map