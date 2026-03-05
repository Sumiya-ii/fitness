import { z } from 'zod';

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
