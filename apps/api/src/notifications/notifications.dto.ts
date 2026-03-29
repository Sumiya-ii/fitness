import { z } from 'zod';

export const updatePreferencesSchema = z.object({
  morningReminder: z.boolean().optional(),
  eveningReminder: z.boolean().optional(),
  reminderTimezone: z.string().max(50).optional(),
  quietHoursStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .nullable(),
  quietHoursEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .nullable(),
  channels: z.array(z.enum(['push', 'telegram', 'email'])).optional(),
});

export type UpdatePreferencesDto = z.infer<typeof updatePreferencesSchema>;

export const registerDeviceTokenSchema = z.object({
  token: z.string().min(1).max(4096),
  platform: z.enum(['ios', 'android']),
});

export type RegisterDeviceTokenDto = z.infer<typeof registerDeviceTokenSchema>;
