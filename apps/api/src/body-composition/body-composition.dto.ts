import { z } from 'zod';

export const logMeasurementSchema = z.object({
  waistCm: z.number().min(40).max(200),
  neckCm: z.number().min(20).max(80),
  hipCm: z.number().min(50).max(200).optional(),
  loggedAt: z.string().date().optional(),
});

export type LogMeasurementDto = z.infer<typeof logMeasurementSchema>;
