import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma';
import { z } from 'zod';

/** PRD Section 10.2: Required analytics events */
export const ANALYTICS_EVENT_NAMES = [
  'onboarding_completed',
  'target_generated',
  'meal_log_started',
  'meal_log_saved',
  'voice_log_processed',
  'photo_log_processed',
  'telegram_linked',
  'weekly_checkin_completed',
  'subscription_started',
  'subscription_canceled',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

const eventNameSchema = z.enum(ANALYTICS_EVENT_NAMES);

export interface EmitEventParams {
  event: string;
  userId: string;
  properties?: Record<string, unknown>;
  sessionId?: string;
  platform?: string;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validates event name against schema and stores in analytics_events.
   */
  async emit(
    event: string,
    userId: string,
    properties?: Record<string, unknown>,
    sessionId?: string,
    platform?: string,
  ): Promise<void> {
    const parsed = eventNameSchema.safeParse(event);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }

    await this.prisma.analyticsEvent.create({
      data: {
        userId,
        event: parsed.data,
        properties: (properties as Prisma.InputJsonValue) ?? undefined,
        sessionId: sessionId ?? null,
        platform: platform ?? null,
      },
    });
  }
}
