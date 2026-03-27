import { z } from 'zod';
import {
  SUPPORTED_LOCALES,
  UNIT_SYSTEMS,
  GENDERS,
  ACTIVITY_LEVELS,
  DIET_PREFERENCES,
} from '@coach/shared';

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  locale: z.enum(SUPPORTED_LOCALES).optional(),
  unitSystem: z.enum(UNIT_SYSTEMS).optional(),
  gender: z.enum(GENDERS).optional(),
  birthDate: z
    .string()
    .date()
    .refine(
      (val) => {
        const birth = new Date(val);
        const age = (Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        return age >= 13;
      },
      { message: 'User must be at least 13 years old' },
    )
    .optional(),
  heightCm: z.number().min(50).max(300).optional(),
  weightKg: z.number().min(20).max(500).optional(),
  goalWeightKg: z.number().min(20).max(500).optional(),
  activityLevel: z.enum(ACTIVITY_LEVELS).optional(),
  dietPreference: z.enum(DIET_PREFERENCES).optional(),
});

export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
