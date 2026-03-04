import { z } from 'zod';

export const createWeightLogSchema = z.object({
  weightKg: z.number().min(20).max(500),
  loggedAt: z.string().date().optional(),
});

export type CreateWeightLogDto = z.infer<typeof createWeightLogSchema>;
