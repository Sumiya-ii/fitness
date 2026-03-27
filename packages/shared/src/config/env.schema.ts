import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  // PostgreSQL
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().url(),

  // Firebase Auth
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().email().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),

  // Bull Board dashboard credentials (basic auth)
  BULL_BOARD_USER: z.string().min(1).default('admin'),
  BULL_BOARD_PASSWORD: z.string().min(1).default('admin'),

  // Admin access
  ADMIN_USER_IDS: z
    .string()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean)
        : [],
    ),

  // Telegram Bot
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),

  // S3-compatible object storage
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_ENDPOINT: z.string().url().optional(),

  // Typesense
  TYPESENSE_HOST: z.string().optional(),
  TYPESENSE_PORT: z.coerce.number().int().positive().optional(),
  TYPESENSE_API_KEY: z.string().optional(),

  // STT providers
  STT_PROVIDER: z.string().optional(),
  STT_API_KEY: z.string().optional(),
  GOOGLE_STT_CREDENTIALS: z.string().optional(),
  GOOGLE_STT_API_KEY: z.string().optional(),
  CHIMEGE_API_KEY: z.string().optional(),

  // Vision provider for food photo analysis
  // 'gemini' uses Gemini 2.0 Flash (primary, cheaper); 'openai' forces GPT-4o only
  // When set to 'gemini', GPT-4o is used as automatic fallback if Gemini fails
  VISION_PROVIDER: z.enum(['gemini', 'openai']).default('gemini'),
  GEMINI_API_KEY: z.string().optional(),

  // OpenAI (Vision fallback + general AI)
  OPENAI_API_KEY: z.string().optional(),

  // Observability
  SENTRY_DSN: z.string().url().optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),

  // PostHog
  POSTHOG_API_KEY: z.string().optional(),
  POSTHOG_HOST: z.string().url().optional(),

  // QPay
  QPAY_API_URL: z.string().url().optional(),
  QPAY_CLIENT_ID: z.string().optional(),
  QPAY_CLIENT_SECRET: z.string().optional(),
  QPAY_INVOICE_CODE: z.string().optional(),
  QPAY_CALLBACK_TOKEN: z.string().optional(),
  QPAY_INVOICE_TTL_MINUTES: z.coerce.number().int().positive().optional(),

  // RevenueCat
  REVENUECAT_WEBHOOK_SECRET: z.string().optional(),
  REVENUECAT_API_KEY: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validates process.env against the schema.
 * Throws with descriptive errors on invalid/missing required keys.
 */
export function validateEnv(env: Record<string, string | undefined> = process.env): EnvConfig {
  const result = envSchema.safeParse(env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${formatted}`);
  }

  return result.data;
}
