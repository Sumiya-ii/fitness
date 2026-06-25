import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: Record<string, Record<string, jest.Mock>>;

  const mockPreferences = {
    id: 'pref-uuid',
    userId: 'user-uuid',
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

      expect(result.channels).toEqual(['push']);
      expect(result.createdAt).toBe('2026-03-04T00:00:00.000Z');
    });

    it('should create default preferences when none exist', async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue(null);

      const result = await service.getPreferences('user-uuid');

      expect(result.channels).toEqual(['push']);
      expect(prisma.notificationPreference.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-uuid',
          channels: ['push'],
        }),
      });
    });

    it('should not include reminder fields in default create', async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue(null);
      await service.getPreferences('user-uuid');

      const createCall = prisma.notificationPreference.create.mock.calls[0][0];
      expect(createCall.data).not.toHaveProperty('morningReminder');
      expect(createCall.data).not.toHaveProperty('eveningReminder');
      expect(createCall.data).not.toHaveProperty('reminderTimezone');
      expect(createCall.data).not.toHaveProperty('quietHoursStart');
      expect(createCall.data).not.toHaveProperty('quietHoursEnd');
    });
  });

  describe('updatePreferences', () => {
    it('should update channels', async () => {
      const updated = { ...mockPreferences, channels: ['push', 'telegram'] };
      prisma.notificationPreference.upsert.mockResolvedValue(updated);

      const result = await service.updatePreferences('user-uuid', {
        channels: ['push', 'telegram'],
      });

      expect(result.channels).toEqual(['push', 'telegram']);
      expect(prisma.notificationPreference.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-uuid' },
        create: expect.objectContaining({ channels: ['push', 'telegram'] }),
        update: { channels: ['push', 'telegram'] },
      });
    });

    it('should use default channels on create when not provided', async () => {
      await service.updatePreferences('user-uuid', {});

      const upsertCall = prisma.notificationPreference.upsert.mock.calls[0][0];
      expect(upsertCall.create.channels).toEqual(['push']);
      expect(upsertCall.update).toEqual({});
    });

    it('should return formatted preferences', async () => {
      const result = await service.updatePreferences('user-uuid', {});

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('channels');
      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('updatedAt');
      expect(result).not.toHaveProperty('morningReminder');
      expect(result).not.toHaveProperty('eveningReminder');
      expect(result).not.toHaveProperty('reminderTimezone');
    });
  });
});
