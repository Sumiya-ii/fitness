import { z } from 'zod';
export declare const envSchema: z.ZodObject<{
    NODE_ENV: z.ZodDefault<z.ZodEnum<{
        development: "development";
        production: "production";
        test: "test";
    }>>;
    PORT: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    DATABASE_URL: z.ZodString;
    REDIS_URL: z.ZodString;
    FIREBASE_PROJECT_ID: z.ZodString;
    FIREBASE_CLIENT_EMAIL: z.ZodOptional<z.ZodString>;
    FIREBASE_PRIVATE_KEY: z.ZodOptional<z.ZodString>;
    TELEGRAM_BOT_TOKEN: z.ZodOptional<z.ZodString>;
    TELEGRAM_WEBHOOK_SECRET: z.ZodOptional<z.ZodString>;
    S3_BUCKET: z.ZodOptional<z.ZodString>;
    S3_REGION: z.ZodOptional<z.ZodString>;
    S3_ACCESS_KEY_ID: z.ZodOptional<z.ZodString>;
    S3_SECRET_ACCESS_KEY: z.ZodOptional<z.ZodString>;
    S3_ENDPOINT: z.ZodOptional<z.ZodString>;
    TYPESENSE_HOST: z.ZodOptional<z.ZodString>;
    TYPESENSE_PORT: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    TYPESENSE_API_KEY: z.ZodOptional<z.ZodString>;
    STT_PROVIDER: z.ZodOptional<z.ZodString>;
    STT_API_KEY: z.ZodOptional<z.ZodString>;
    GOOGLE_STT_CREDENTIALS: z.ZodOptional<z.ZodString>;
    CHIMEGE_API_KEY: z.ZodOptional<z.ZodString>;
    SENTRY_DSN: z.ZodOptional<z.ZodString>;
    OTEL_EXPORTER_OTLP_ENDPOINT: z.ZodOptional<z.ZodString>;
    POSTHOG_API_KEY: z.ZodOptional<z.ZodString>;
    POSTHOG_HOST: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type EnvConfig = z.infer<typeof envSchema>;
/**
 * Validates process.env against the schema.
 * Throws with descriptive errors on invalid/missing required keys.
 */
export declare function validateEnv(env?: Record<string, string | undefined>): EnvConfig;
//# sourceMappingURL=env.schema.d.ts.map