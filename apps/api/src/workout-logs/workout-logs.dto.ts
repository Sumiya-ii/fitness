import { z } from 'zod';

const notFuture = (v: string | undefined) => !v || new Date(v) <= new Date(Date.now() + 5 * 60_000);

const loggedAtField = z
  .string()
  .datetime()
  .refine(notFuture, { message: 'loggedAt cannot be in the future' })
  .optional();

export const createWorkoutLogSchema = z.object({
  workoutType: z.string().min(1).max(50),
  durationMin: z.number().int().positive().max(1440).optional(),
  note: z.string().max(500).optional(),
  loggedAt: loggedAtField,
});

export const updateWorkoutLogSchema = z.object({
  workoutType: z.string().min(1).max(50).optional(),
  durationMin: z.number().int().positive().max(1440).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  loggedAt: loggedAtField,
});

export const workoutLogQuerySchema = z.object({
  date: z.string().date().optional(),
  days: z.coerce.number().int().positive().max(365).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateWorkoutLogDto = z.infer<typeof createWorkoutLogSchema>;
export type UpdateWorkoutLogDto = z.infer<typeof updateWorkoutLogSchema>;
export type WorkoutLogQueryDto = z.infer<typeof workoutLogQuerySchema>;
