import { z } from 'zod';
import { GOAL_TYPES } from '@coach/shared';

export const createTargetSchema = z.object({
  goalType: z.enum(GOAL_TYPES),
  weeklyRateKg: z.number().min(0).max(1.5),
  weightKg: z.number().min(30).max(500),
});

export type CreateTargetDto = z.infer<typeof createTargetSchema>;
