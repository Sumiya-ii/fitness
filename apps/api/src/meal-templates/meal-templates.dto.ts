import { z } from 'zod';

const templateItemSchema = z.object({
  foodId: z.string().uuid(),
  servingId: z.string().uuid(),
  quantity: z.number().positive(),
  sortOrder: z.number().int().min(0).optional(),
});

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
  items: z.array(templateItemSchema).min(1),
});

export const createFromLogSchema = z.object({
  name: z.string().min(1).max(200),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).nullable().optional(),
  items: z.array(templateItemSchema).min(1).optional(),
});

const logItemOverrideSchema = z.object({
  foodId: z.string().uuid(),
  servingId: z.string().uuid(),
  quantity: z.number().positive(),
});

export const logTemplateSchema = z.object({
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
  loggedAt: z.string().datetime().optional(),
  note: z.string().max(500).optional(),
  items: z.array(logItemOverrideSchema).min(1),
});

export const templateQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export type CreateTemplateDto = z.infer<typeof createTemplateSchema>;
export type CreateFromLogDto = z.infer<typeof createFromLogSchema>;
export type UpdateTemplateDto = z.infer<typeof updateTemplateSchema>;
export type LogTemplateDto = z.infer<typeof logTemplateSchema>;
export type TemplateQueryDto = z.infer<typeof templateQuerySchema>;
