import { createHmac } from 'crypto';
import {
  BadRequestException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { PrismaService } from '../prisma';
import { ConfigService } from '../config';

function hashLinkCode(code: string): string {
  return createHmac('sha256', process.env.LINK_CODE_SECRET!).update(code).digest('hex');
}

const mockRedis = {
  setex: jest.fn().mockResolvedValue('OK'),
  get: jest.fn(),
  del: jest.fn().mockResolvedValue(1),
  incr: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(1),
};

describe('TelegramService', () => {
  let service: TelegramService;
  let prisma: Record<string, Record<string, jest.Mock>>;
  let config: { get: jest.Mock };
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.LINK_CODE_SECRET = 'test-secret';
    jest.clearAllMocks();
    config = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'LINK_CODE_SECRET') return 'test-secret';
        return undefined;
      }),
    };
    prisma = {
      telegramLink: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
      notificationPreference: {
        findUnique: jest.fn().mockResolvedValue({ userId: 'user-uuid', channels: ['push'] }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    service = new TelegramService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      mockRedis as never,
    );
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('generateLinkCode', () => {
    it('should throw ServiceUnavailableException when LINK_CODE_SECRET is not configured', async () => {
      config.get.mockImplementation((key: string) => {
        if (key === 'LINK_CODE_SECRET') return undefined;
        return undefined;
      });
      const unconfiguredService = new TelegramService(
        prisma as unknown as PrismaService,
        config as unknown as ConfigService,
        mockRedis as never,
      );

      await expect(unconfiguredService.generateLinkCode('user-uuid')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('should generate 6-digit code and store its hash in Redis with 5-min TTL', async () => {
      const code = await service.generateLinkCode('user-uuid');

      expect(code).toMatch(/^\d{6}$/);
      const expectedKey = `telegram:link:${hashLinkCode(code)}`;
      expect(mockRedis.setex).toHaveBeenCalledWith(expectedKey, 300, 'user-uuid');
      // Raw code must not appear in the Redis key
      expect(mockRedis.setex.mock.calls[0][0]).not.toBe(`telegram:link:${code}`);
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
      const hashedKey = `telegram:link:${hashLinkCode('123456')}`;

      expect(result.success).toBe(true);
      expect(result.userId).toBe('user-uuid');
      // del must use the hashed key, not the raw code
      expect(mockRedis.del).toHaveBeenCalledWith(hashedKey);
      expect(mockRedis.del).not.toHaveBeenCalledWith('telegram:link:123456');
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

    it('increments the per-code attempt counter and sets a TTL on first attempt', async () => {
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.get.mockResolvedValue(null);

      await expect(service.confirmLink('tg-123', 'chat-123', '123456')).rejects.toThrow(
        BadRequestException,
      );

      const attemptKey = `telegram:confirm-attempts:${hashLinkCode('123456')}`;
      expect(mockRedis.incr).toHaveBeenCalledWith(attemptKey);
      expect(mockRedis.expire).toHaveBeenCalledWith(attemptKey, 300);
    });

    it('does not reset the TTL on subsequent attempts', async () => {
      mockRedis.incr.mockResolvedValue(3);
      mockRedis.get.mockResolvedValue(null);

      await expect(service.confirmLink('tg-123', 'chat-123', '123456')).rejects.toThrow(
        BadRequestException,
      );

      expect(mockRedis.expire).not.toHaveBeenCalled();
    });

    it('rejects with 429 once attempts exceed the cap, without checking the code', async () => {
      mockRedis.incr.mockResolvedValue(6); // CONFIRM_MAX_ATTEMPTS = 5

      await expect(service.confirmLink('tg-123', 'chat-123', '000000')).rejects.toThrow(
        HttpException,
      );
      // Must short-circuit before reading the stored code
      expect(mockRedis.get).not.toHaveBeenCalled();
    });

    it('clears the attempt counter after a successful link', async () => {
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.get.mockResolvedValue('user-uuid');
      prisma.telegramLink.findFirst.mockResolvedValue(null);
      prisma.telegramLink.upsert.mockResolvedValue({ userId: 'user-uuid', linkedAt: new Date() });

      await service.confirmLink('tg-123', 'chat-123', '123456', 'username');

      const attemptKey = `telegram:confirm-attempts:${hashLinkCode('123456')}`;
      expect(mockRedis.del).toHaveBeenCalledWith(attemptKey);
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
