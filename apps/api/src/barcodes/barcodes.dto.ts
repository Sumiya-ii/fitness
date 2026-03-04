import { z } from 'zod';

export const submitBarcodeSchema = z.object({
  code: z.string().min(1).max(50),
  normalizedName: z.string().min(1).max(500),
  caloriesPer100g: z.number().min(0),
  proteinPer100g: z.number().min(0),
  carbsPer100g: z.number().min(0),
  fatPer100g: z.number().min(0),
  servingLabel: z.string().min(1).max(100),
  gramsPerUnit: z.number().positive(),
  labelPhotoUrls: z.array(z.string().url()).optional(),
});

export type SubmitBarcodeDto = z.infer<typeof submitBarcodeSchema>;
