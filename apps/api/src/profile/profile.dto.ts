import { z } from 'zod';
import { SUPPORTED_LOCALES, UNIT_SYSTEMS } from '@coach/shared';

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  locale: z.enum(SUPPORTED_LOCALES).optional(),
  unitSystem: z.enum(UNIT_SYSTEMS).optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  birthDate: z.string().date().optional(),
  heightCm: z.number().min(50).max(300).optional(),
  activityLevel: z
    .enum(['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extra_active'])
    .optional(),
});

export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
