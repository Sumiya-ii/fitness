import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: Record<string, Record<string, jest.Mock>>;

  const mockPreferences = {
    id: 'pref-uuid',
    userId: 'user-uuid',
    morningReminder: true,
    eveningReminder: true,
    reminderTimezone: 'Asia/Ulaanbaatar',
    quietHoursStart: null,
    quietHoursEnd: null,
    channels: ['push'],
    createdAt: new Date('2026-03-04'),
    updatedAt: new Date('2026-03-04'),
  };

  beforeEach(() => {
    prisma = {
      notificationPreference: {
        findUnique: jest.fn().mockResolvedValue(mockPreferences),
        create: jest.fn().mockResolvedValue(mockPreferences),
        upsert: jest.fn().mockResolvedValue(mockPreferences),
      },
    };
    service = new NotificationsService(prisma as unknown as PrismaService);
  });

  describe('getPreferences', () => {
    it('should return existing preferences', async () => {
      const result = await service.getPreferences('user-uuid');

      expect(result.morningReminder).toBe(true);
      expect(result.eveningReminder).toBe(true);
      expect(result.reminderTimezone).toBe('Asia/Ulaanbaatar');
      expect(result.channels).toEqual(['push']);
    });

    it('should create default preferences when none exist', async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue(null);

      const result = await service.getPreferences('user-uuid');

      expect(result.morningReminder).toBe(true);
      expect(prisma.notificationPreference.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-uuid',
          morningReminder: true,
          eveningReminder: true,
          reminderTimezone: 'Asia/Ulaanbaatar',
          channels: ['push'],
        }),
      });
    });
  });

  describe('updatePreferences', () => {
    it('should update preferences', async () => {
      const updated = {
        ...mockPreferences,
        morningReminder: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
      };
      prisma.notificationPreference.upsert.mockResolvedValue(updated);

      const result = await service.updatePreferences('user-uuid', {
        morningReminder: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
      });

      expect(result.morningReminder).toBe(false);
      expect(result.quietHoursStart).toBe('22:00');
      expect(result.quietHoursEnd).toBe('07:00');
      expect(prisma.notificationPreference.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-uuid' },
        create: expect.any(Object),
        update: expect.objectContaining({
          morningReminder: false,
          quietHoursStart: '22:00',
          quietHoursEnd: '07:00',
        }),
      });
    });
  });
});
