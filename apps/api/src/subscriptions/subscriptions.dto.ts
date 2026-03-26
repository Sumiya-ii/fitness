import { z } from 'zod';

// ---------------------------------------------------------------------------
// Generic (internal) webhook — kept for QPay and manual adjustments
// ---------------------------------------------------------------------------
export const webhookPayloadSchema = z.object({
  event: z.enum(['started', 'renewed', 'canceled', 'expired', 'refunded']),
  provider: z.enum(['apple', 'google', 'qpay']),
  providerEventId: z.string().optional(),
  userId: z.string().uuid().optional(),
  providerSubId: z.string().optional(),
  currentPeriodStart: z.string().datetime().optional(),
  currentPeriodEnd: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type WebhookPayloadDto = z.infer<typeof webhookPayloadSchema>;

// ---------------------------------------------------------------------------
// RevenueCat server-to-server webhook
// https://www.revenuecat.com/docs/webhooks
// ---------------------------------------------------------------------------
export const revenueCatEventSchema = z.object({
  type: z.enum([
    'INITIAL_PURCHASE',
    'RENEWAL',
    'CANCELLATION',
    'EXPIRATION',
    'BILLING_ISSUES_DETECTED',
    'UNCANCELLATION',
    'REFUND',
    'NON_RENEWING_PURCHASE',
    'PRODUCT_CHANGE',
    'SUBSCRIPTION_PAUSED',
    'TRANSFER',
  ]),
  id: z.string(),
  app_user_id: z.string(),
  original_app_user_id: z.string(),
  aliases: z.array(z.string()).optional(),
  product_id: z.string().optional(),
  entitlement_id: z.string().nullable().optional(),
  entitlement_ids: z.array(z.string()).nullable().optional(),
  environment: z.enum(['PRODUCTION', 'SANDBOX']),
  event_timestamp_ms: z.number(),
  purchased_at_ms: z.number().nullable().optional(),
  expiration_at_ms: z.number().nullable().optional(),
  store: z.enum(['APP_STORE', 'PLAY_STORE', 'AMAZON', 'STRIPE', 'PROMOTIONAL', 'RC_BILLING']),
  is_family_share: z.boolean().optional(),
  country_code: z.string().optional(),
  currency: z.string().nullable().optional(),
  price: z.number().nullable().optional(),
  transaction_id: z.string().nullable().optional(),
  original_transaction_id: z.string().nullable().optional(),
  is_trial_conversion: z.boolean().nullable().optional(),
  period_type: z.enum(['NORMAL', 'FREE_TRIAL', 'INTRO_PRICE']).nullable().optional(),
  cancel_reason: z.string().nullable().optional(),
  expiration_reason: z.string().nullable().optional(),
  presented_offering_id: z.string().nullable().optional(),
  offer_code: z.string().nullable().optional(),
  tax_percentage: z.number().nullable().optional(),
  commission_percentage: z.number().nullable().optional(),
  takehome_percentage: z.number().nullable().optional(),
});

export const revenueCatWebhookSchema = z.object({
  api_version: z.string(),
  event: revenueCatEventSchema,
});

export type RevenueCatWebhookDto = z.infer<typeof revenueCatWebhookSchema>;
export type RevenueCatEventDto = z.infer<typeof revenueCatEventSchema>;
