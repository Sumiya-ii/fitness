import { z } from 'zod';

export const moderationQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'merged']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const rejectSchema = z.object({
  note: z.string().max(500).optional(),
});

export type ModerationQueryDto = z.infer<typeof moderationQuerySchema>;
export type RejectDto = z.infer<typeof rejectSchema>;

// ── Outbound message log ─────────────────────────────────────────

export const messageQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  messageType: z.string().optional(),
  channel: z.enum(['telegram', 'push']).optional(),
  status: z.enum(['sent', 'failed']).optional(),
  startDate: z.string().datetime({ offset: true }).optional(),
  endDate: z.string().datetime({ offset: true }).optional(),
  // Cursor-based pagination: pass the sentAt+id of the last item
  cursor: z.string().optional(), // base64-encoded "{sentAt}|{id}"
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const messageStatsQuerySchema = z.object({
  days: z.coerce.number().int().positive().max(90).default(30),
});

export type MessageQueryDto = z.infer<typeof messageQuerySchema>;
export type MessageStatsQueryDto = z.infer<typeof messageStatsQuerySchema>;
