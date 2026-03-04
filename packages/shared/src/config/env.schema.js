"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.envSchema = void 0;
exports.validateEnv = validateEnv;
const zod_1 = require("zod");
exports.envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    PORT: zod_1.z.coerce.number().int().positive().default(3000),
    // PostgreSQL
    DATABASE_URL: zod_1.z.string().url(),
    // Redis
    REDIS_URL: zod_1.z.string().url(),
    // Firebase Auth
    FIREBASE_PROJECT_ID: zod_1.z.string().min(1),
    FIREBASE_CLIENT_EMAIL: zod_1.z.string().email().optional(),
    FIREBASE_PRIVATE_KEY: zod_1.z.string().optional(),
    // Telegram Bot
    TELEGRAM_BOT_TOKEN: zod_1.z.string().optional(),
    TELEGRAM_WEBHOOK_SECRET: zod_1.z.string().optional(),
    // S3-compatible object storage
    S3_BUCKET: zod_1.z.string().optional(),
    S3_REGION: zod_1.z.string().optional(),
    S3_ACCESS_KEY_ID: zod_1.z.string().optional(),
    S3_SECRET_ACCESS_KEY: zod_1.z.string().optional(),
    S3_ENDPOINT: zod_1.z.string().url().optional(),
    // Typesense
    TYPESENSE_HOST: zod_1.z.string().optional(),
    TYPESENSE_PORT: zod_1.z.coerce.number().int().positive().optional(),
    TYPESENSE_API_KEY: zod_1.z.string().optional(),
    // STT providers
    STT_PROVIDER: zod_1.z.string().optional(),
    STT_API_KEY: zod_1.z.string().optional(),
    GOOGLE_STT_CREDENTIALS: zod_1.z.string().optional(),
    CHIMEGE_API_KEY: zod_1.z.string().optional(),
    // Observability
    SENTRY_DSN: zod_1.z.string().url().optional(),
    OTEL_EXPORTER_OTLP_ENDPOINT: zod_1.z.string().url().optional(),
    // PostHog
    POSTHOG_API_KEY: zod_1.z.string().optional(),
    POSTHOG_HOST: zod_1.z.string().url().optional(),
});
/**
 * Validates process.env against the schema.
 * Throws with descriptive errors on invalid/missing required keys.
 */
function validateEnv(env = process.env) {
    const result = exports.envSchema.safeParse(env);
    if (!result.success) {
        const formatted = result.error.issues
            .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
            .join('\n');
        throw new Error(`Environment validation failed:\n${formatted}`);
    }
    return result.data;
}
//# sourceMappingURL=env.schema.js.map