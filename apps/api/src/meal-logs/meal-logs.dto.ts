import { z } from 'zod';

// Allow up to 5 minutes in the future to tolerate clock skew between client and server
const notFuture = (v: string | undefined) => !v || new Date(v) <= new Date(Date.now() + 5 * 60_000);
const loggedAtField = z
  .string()
  .datetime()
  .refine(notFuture, { message: 'loggedAt cannot be in the future' })
  .optional();

const mealLogItemSchema = z.object({
  foodId: z.string().uuid(),
  servingId: z.string().uuid(),
  quantity: z.number().positive(),
});

export const createMealLogSchema = z.object({
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
  source: z.enum(['text', 'quick_add', 'barcode', 'voice', 'photo', 'telegram']).default('text'),
  loggedAt: loggedAtField,
  note: z.string().max(500).optional(),
  items: z.array(mealLogItemSchema).min(1),
});

export const quickAddSchema = z.object({
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
  loggedAt: loggedAtField,
  note: z.string().max(500).optional(),
  calories: z.number().int().min(0),
  proteinGrams: z.number().min(0).optional().default(0),
  carbsGrams: z.number().min(0).optional().default(0),
  fatGrams: z.number().min(0).optional().default(0),
  fiberGrams: z.number().min(0).optional(),
  sugarGrams: z.number().min(0).optional(),
  sodiumMg: z.number().min(0).optional(),
  saturatedFatGrams: z.number().min(0).optional(),
  source: z
    .enum(['text', 'quick_add', 'barcode', 'voice', 'photo', 'telegram'])
    .optional()
    .default('quick_add'),
});

// Structured voice-log save: one row per parsed item, no foodId required.
// The draft acts as provenance — it must belong to the calling user.
const voiceLogItemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  quantity: z.number().positive().default(1),
  unit: z.string().trim().min(1).max(20).default('serving'),
  grams: z.number().min(0).default(0),
  calories: z.number().min(0),
  protein: z.number().min(0).default(0),
  carbs: z.number().min(0).default(0),
  fat: z.number().min(0).default(0),
  fiber: z.number().min(0).optional(),
  sugar: z.number().min(0).optional(),
  sodium: z.number().min(0).optional(),
  saturatedFat: z.number().min(0).optional(),
});

export const fromVoiceSchema = z.object({
  draftId: z.string().uuid(),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
  loggedAt: loggedAtField,
  note: z.string().max(500).optional(),
  items: z.array(voiceLogItemSchema).min(1).max(20),
});

export const updateMealLogSchema = z.object({
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
  note: z.string().max(500).nullable().optional(),
  loggedAt: loggedAtField,
});

export const mealLogQuerySchema = z.object({
  date: z.string().date().optional(),
  tz: z.string().max(50).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export type CreateMealLogDto = z.infer<typeof createMealLogSchema>;
export type QuickAddDto = z.infer<typeof quickAddSchema>;
export type FromVoiceDto = z.infer<typeof fromVoiceSchema>;
export type UpdateMealLogDto = z.infer<typeof updateMealLogSchema>;
export type MealLogQueryDto = z.infer<typeof mealLogQuerySchema>;
