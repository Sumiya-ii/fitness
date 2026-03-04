import { z } from 'zod';

const mealLogItemSchema = z.object({
  foodId: z.string().uuid(),
  servingId: z.string().uuid(),
  quantity: z.number().positive(),
});

export const createMealLogSchema = z.object({
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
  source: z
    .enum(['text', 'quick_add', 'barcode', 'voice', 'photo', 'telegram'])
    .default('text'),
  loggedAt: z.string().datetime().optional(),
  note: z.string().max(500).optional(),
  items: z.array(mealLogItemSchema).min(1),
});

export const quickAddSchema = z.object({
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
  loggedAt: z.string().datetime().optional(),
  note: z.string().max(500).optional(),
  calories: z.number().int().min(0),
  proteinGrams: z.number().min(0).optional().default(0),
  carbsGrams: z.number().min(0).optional().default(0),
  fatGrams: z.number().min(0).optional().default(0),
  source: z
    .enum(['text', 'quick_add', 'barcode', 'voice', 'photo', 'telegram'])
    .optional()
    .default('quick_add'),
});

export const mealLogQuerySchema = z.object({
  date: z.string().date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export type CreateMealLogDto = z.infer<typeof createMealLogSchema>;
export type QuickAddDto = z.infer<typeof quickAddSchema>;
export type MealLogQueryDto = z.infer<typeof mealLogQuerySchema>;
