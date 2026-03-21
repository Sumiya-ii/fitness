import { z } from 'zod';

export const addWaterSchema = z.object({
  amountMl: z.number().int().min(1).max(5000),
  loggedAt: z.string().datetime().optional(),
});

export type AddWaterDto = z.infer<typeof addWaterSchema>;
