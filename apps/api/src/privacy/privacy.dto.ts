import { z } from 'zod';

export const createConsentSchema = z.object({
  consentType: z.enum(['health_data', 'marketing', 'analytics']),
  version: z.string().min(1).max(20),
  accepted: z.boolean(),
  ipAddress: z.string().max(45).optional(),
  userAgent: z.string().max(500).optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateConsentDto = z.infer<typeof createConsentSchema>;
export type PaginationDto = z.infer<typeof paginationSchema>;
