import { z } from 'zod';
import {
  GOAL_TYPES,
  GENDERS,
  ACTIVITY_LEVELS,
  DIET_PREFERENCES,
} from '@coach/shared';

export const completeOnboardingSchema = z.object({
  goalType: z.enum(GOAL_TYPES),
  goalWeightKg: z.number().min(20).max(500),
  weeklyRateKg: z.number().min(0).max(1.5),
  gender: z.enum(GENDERS),
  birthDate: z.string().date(),
  heightCm: z.number().min(50).max(300),
  weightKg: z.number().min(20).max(500),
  activityLevel: z.enum(ACTIVITY_LEVELS),
  dietPreference: z.enum(DIET_PREFERENCES),
});

export type CompleteOnboardingDto = z.infer<typeof completeOnboardingSchema>;
