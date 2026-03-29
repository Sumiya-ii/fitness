import { BadRequestException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../prisma';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: Record<string, Record<string, jest.Mock>>;

  beforeEach(() => {
    prisma = {
      analyticsEvent: {
        create: jest.fn().mockResolvedValue({
          id: 'evt-uuid',
          userId: 'user-uuid',
          event: 'onboarding_completed',
          properties: null,
          sessionId: null,
          platform: null,
          createdAt: new Date(),
        }),
      },
    };
    service = new AnalyticsService(prisma as unknown as PrismaService);
  });

  describe('emit', () => {
    it('should emit valid event and store in analytics_events', async () => {
      await service.emit('onboarding_completed', 'user-uuid');

      expect(prisma.analyticsEvent.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-uuid',
          event: 'onboarding_completed',
          properties: undefined,
          sessionId: null,
          platform: null,
        },
      });
    });

    it('should reject unknown event', async () => {
      await expect(service.emit('unknown_event', 'user-uuid')).rejects.toThrow(BadRequestException);

      expect(prisma.analyticsEvent.create).not.toHaveBeenCalled();
    });

    it('should store event with properties', async () => {
      const properties = { step: 3, goalType: 'lose' };
      await service.emit('target_generated', 'user-uuid', properties);

      expect(prisma.analyticsEvent.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-uuid',
          event: 'target_generated',
          properties,
          sessionId: null,
          platform: null,
        },
      });
    });

    it('should store event with sessionId and platform', async () => {
      await service.emit('meal_log_saved', 'user-uuid', undefined, 'sess-123', 'ios');

      expect(prisma.analyticsEvent.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-uuid',
          event: 'meal_log_saved',
          properties: undefined,
          sessionId: 'sess-123',
          platform: 'ios',
        },
      });
    });
  });
});
