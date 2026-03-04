import { z } from 'zod';

export const confirmLinkSchema = z.object({
  telegramUserId: z.string().min(1),
  chatId: z.string().min(1),
  code: z.string().length(6),
  username: z.string().optional(),
});

export type ConfirmLinkDto = z.infer<typeof confirmLinkSchema>;
