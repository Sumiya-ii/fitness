import { z } from 'zod';

export const emitEventSchema = z.object({
  event: z.string().min(1),
  properties: z.record(z.string(), z.unknown()).optional(),
  sessionId: z.string().max(100).optional(),
  platform: z.string().max(20).optional(),
});

export type EmitEventDto = z.infer<typeof emitEventSchema>;
