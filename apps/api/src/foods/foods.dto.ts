import { z } from 'zod';
import { SUPPORTED_LOCALES } from '@coach/shared';

const servingSchema = z.object({
  label: z.string().min(1).max(100),
  labelMn: z.string().max(100).optional(),
  gramsPerUnit: z.number().positive(),
  isDefault: z.boolean().optional(),
});

const nutrientSchema = z.object({
  caloriesPer100g: z.number().min(0),
  proteinPer100g: z.number().min(0),
  carbsPer100g: z.number().min(0),
  fatPer100g: z.number().min(0),
  fiberPer100g: z.number().min(0).optional(),
});

const localizationSchema = z.object({
  locale: z.enum(SUPPORTED_LOCALES),
  name: z.string().min(1).max(500),
});

const aliasSchema = z.object({
  alias: z.string().min(1).max(500),
  locale: z.enum(SUPPORTED_LOCALES).default('mn'),
});

export const createFoodSchema = z.object({
  normalizedName: z.string().min(1).max(500),
  locale: z.enum(SUPPORTED_LOCALES).default('mn'),
  sourceType: z.enum(['seed', 'user', 'admin', 'import']).default('admin'),
  sourceRef: z.string().optional(),
  servings: z.array(servingSchema).min(1),
  nutrients: nutrientSchema,
  localizations: z.array(localizationSchema).optional(),
  aliases: z.array(aliasSchema).optional(),
  barcodes: z.array(z.string().min(1).max(50)).optional(),
});

export const updateFoodSchema = createFoodSchema.partial().omit({
  sourceType: true,
  sourceRef: true,
});

export const foodQuerySchema = z.object({
  locale: z.enum(SUPPORTED_LOCALES).optional(),
  status: z.enum(['approved', 'pending', 'rejected']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
});

export type CreateFoodDto = z.infer<typeof createFoodSchema>;
export type UpdateFoodDto = z.infer<typeof updateFoodSchema>;
export type FoodQueryDto = z.infer<typeof foodQuerySchema>;
