import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { PrismaService } from '../prisma';
import { ConfigService } from '../config';

const mockRedis = {
  setex: jest.fn().mockResolvedValue('OK'),
  get: jest.fn(),
  del: jest.fn().mockResolvedValue(1),
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});

describe('TelegramService', () => {
  let service: TelegramService;
  let prisma: Record<string, Record<string, jest.Mock>>;
  let config: { get: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    config = { get: jest.fn().mockReturnValue('redis://localhost:6379') };
    prisma = {
      telegramLink: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new TelegramService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
    );
  });

  describe('generateLinkCode', () => {
    it('should generate 6-digit code and store in Redis with 5-min TTL', async () => {
      const code = await service.generateLinkCode('user-uuid');

      expect(code).toMatch(/^\d{6}$/);
      expect(mockRedis.setex).toHaveBeenCalledWith(`telegram:link:${code}`, 300, 'user-uuid');
    });
  });

  describe('confirmLink', () => {
    it('should throw when code is invalid or expired', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(service.confirmLink('tg-123', 'chat-123', '123456', 'user')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create TelegramLink when code is valid', async () => {
      mockRedis.get.mockResolvedValue('user-uuid');
      prisma.telegramLink.findFirst.mockResolvedValue(null);
      prisma.telegramLink.upsert.mockResolvedValue({
        userId: 'user-uuid',
        telegramUserId: 'tg-123',
        linkedAt: new Date(),
      });

      const result = await service.confirmLink('tg-123', 'chat-123', '123456', 'username');

      expect(result.success).toBe(true);
      expect(result.userId).toBe('user-uuid');
      expect(mockRedis.del).toHaveBeenCalledWith('telegram:link:123456');
      expect(prisma.telegramLink.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-uuid' },
        create: expect.objectContaining({
          userId: 'user-uuid',
          telegramUserId: 'tg-123',
          chatId: 'chat-123',
          telegramUsername: 'username',
          active: true,
        }),
        update: expect.objectContaining({
          telegramUserId: 'tg-123',
          chatId: 'chat-123',
          telegramUsername: 'username',
          active: true,
        }),
      });
    });

    it('should throw when Telegram account already linked to another user', async () => {
      mockRedis.get.mockResolvedValue('user-uuid');
      prisma.telegramLink.findFirst.mockResolvedValue({
        userId: 'other-user',
        telegramUserId: 'tg-123',
      });

      await expect(service.confirmLink('tg-123', 'chat-123', '123456')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getLink', () => {
    it('should return linked: false when no link exists', async () => {
      prisma.telegramLink.findUnique.mockResolvedValue(null);

      const result = await service.getLink('user-uuid');

      expect(result.linked).toBe(false);
    });

    it('should return link status when linked', async () => {
      prisma.telegramLink.findUnique.mockResolvedValue({
        telegramUsername: 'coach_user',
        linkedAt: new Date('2026-03-04'),
      });

      const result = await service.getLink('user-uuid');

      expect(result.linked).toBe(true);
      expect(result.telegramUsername).toBe('coach_user');
      expect(result.linkedAt).toBeDefined();
    });
  });

  describe('unlinkAccount', () => {
    it('should deactivate the Telegram link', async () => {
      prisma.telegramLink.findUnique.mockResolvedValue({ userId: 'user-uuid' });
      prisma.telegramLink.update.mockResolvedValue({});

      await service.unlinkAccount('user-uuid');

      expect(prisma.telegramLink.update).toHaveBeenCalledWith({
        where: { userId: 'user-uuid' },
        data: { active: false },
      });
    });

    it('should throw when no link exists', async () => {
      prisma.telegramLink.findUnique.mockResolvedValue(null);

      await expect(service.unlinkAccount('user-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findUserByTelegram', () => {
    it('should return userId when linked', async () => {
      prisma.telegramLink.findFirst.mockResolvedValue({
        userId: 'user-uuid',
      });

      const result = await service.findUserByTelegram('tg-123');

      expect(result).toBe('user-uuid');
    });

    it('should return null when not linked', async () => {
      prisma.telegramLink.findFirst.mockResolvedValue(null);

      const result = await service.findUserByTelegram('tg-123');

      expect(result).toBeNull();
    });
  });
});
