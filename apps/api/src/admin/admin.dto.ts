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
