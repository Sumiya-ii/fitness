import { IdempotencyService } from './idempotency.service';
import { PrismaService } from '../prisma';
import { ConfigService } from '../config';

// Mock ioredis before importing the service
const mockRedisGet = jest.fn();
const mockRedisSet = jest.fn();
const mockRedisDisconnect = jest.fn();
const mockRedisOn = jest.fn();

jest.mock('ioredis', () =>
  jest.fn().mockImplementation(() => ({
    get: mockRedisGet,
    set: mockRedisSet,
    disconnect: mockRedisDisconnect,
    on: mockRedisOn,
  })),
);

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let prisma: Record<string, Record<string, jest.Mock>>;
  let config: { get: jest.Mock };

  const futureDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

  beforeEach(() => {
    jest.clearAllMocks();

    prisma = {
      idempotencyKey: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };

    config = { get: jest.fn().mockReturnValue('redis://localhost:6379') };

    service = new IdempotencyService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('check — Redis fast path', () => {
    it('should return cached response from Redis without hitting DB', async () => {
      mockRedisGet.mockResolvedValue(JSON.stringify({ status: 200, body: 'Logged: rice 200 cal' }));

      const result = await service.check('msg-123');

      expect(result.exists).toBe(true);
      expect(result.response).toEqual({ status: 200, body: 'Logged: rice 200 cal' });
      expect(prisma.idempotencyKey.findUnique).not.toHaveBeenCalled();
    });

    it('should fall through to DB when Redis returns null', async () => {
      mockRedisGet.mockResolvedValue(null);
      prisma.idempotencyKey.findUnique.mockResolvedValue({
        externalEventId: 'msg-123',
        expiresAt: futureDate,
        responseStatus: 200,
        responseBody: 'Logged: rice 200 cal',
      });

      const result = await service.check('msg-123');

      expect(result.exists).toBe(true);
      expect(result.response).toEqual({ status: 200, body: 'Logged: rice 200 cal' });
      expect(prisma.idempotencyKey.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  describe('check — Redis down / DB fallback', () => {
    it('should fall back to DB when Redis throws', async () => {
      mockRedisGet.mockRejectedValue(new Error('ECONNREFUSED'));
      prisma.idempotencyKey.findUnique.mockResolvedValue({
        externalEventId: 'msg-123',
        expiresAt: futureDate,
        responseStatus: 200,
        responseBody: 'OK',
      });

      const result = await service.check('msg-123');

      expect(result.exists).toBe(true);
      expect(prisma.idempotencyKey.findUnique).toHaveBeenCalledTimes(1);
    });

    it('should return exists: false when Redis down and DB key not found', async () => {
      mockRedisGet.mockRejectedValue(new Error('ECONNREFUSED'));
      prisma.idempotencyKey.findUnique.mockResolvedValue(null);

      const result = await service.check('msg-123');

      expect(result.exists).toBe(false);
      expect(result.response).toBeUndefined();
    });

    it('should return exists: false when Redis down and DB key is expired', async () => {
      mockRedisGet.mockRejectedValue(new Error('ECONNREFUSED'));
      prisma.idempotencyKey.findUnique.mockResolvedValue({
        externalEventId: 'msg-123',
        expiresAt: new Date('2020-01-01'),
        responseStatus: 200,
        responseBody: 'old',
      });

      const result = await service.check('msg-123');

      expect(result.exists).toBe(false);
    });
  });

  describe('check — DB only (Redis returns null)', () => {
    beforeEach(() => {
      mockRedisGet.mockResolvedValue(null);
    });

    it('should return exists: false when key not found in DB', async () => {
      prisma.idempotencyKey.findUnique.mockResolvedValue(null);

      const result = await service.check('msg-123');

      expect(result.exists).toBe(false);
      expect(result.response).toBeUndefined();
      expect(prisma.idempotencyKey.findUnique).toHaveBeenCalledWith({
        where: {
          externalSystem_externalEventId: {
            externalSystem: 'telegram',
            externalEventId: 'msg-123',
          },
        },
      });
    });

    it('should return exists: false when key is expired in DB', async () => {
      prisma.idempotencyKey.findUnique.mockResolvedValue({
        externalEventId: 'msg-123',
        expiresAt: new Date('2020-01-01'),
        responseStatus: 200,
        responseBody: { message: 'cached' },
      });

      const result = await service.check('msg-123');

      expect(result.exists).toBe(false);
    });

    it('should return cached response when DB key exists and not expired', async () => {
      prisma.idempotencyKey.findUnique.mockResolvedValue({
        externalEventId: 'msg-123',
        expiresAt: futureDate,
        responseStatus: 200,
        responseBody: 'Logged: rice 200 cal',
      });

      const result = await service.check('msg-123');

      expect(result.exists).toBe(true);
      expect(result.response).toEqual({ status: 200, body: 'Logged: rice 200 cal' });
    });
  });

  describe('store — write-through', () => {
    it('should write to DB and Redis on success', async () => {
      prisma.idempotencyKey.upsert.mockResolvedValue({});
      mockRedisSet.mockResolvedValue('OK');

      await service.store('msg-123', { status: 200, body: 'OK' }, 60);

      expect(prisma.idempotencyKey.upsert).toHaveBeenCalledWith({
        where: {
          externalSystem_externalEventId: {
            externalSystem: 'telegram',
            externalEventId: 'msg-123',
          },
        },
        create: expect.objectContaining({
          externalSystem: 'telegram',
          externalEventId: 'msg-123',
          responseStatus: 200,
          responseBody: 'OK',
          expiresAt: expect.any(Date),
        }),
        update: expect.objectContaining({
          responseStatus: 200,
          responseBody: 'OK',
        }),
      });

      expect(mockRedisSet).toHaveBeenCalledWith(
        'idempotency:telegram:msg-123',
        JSON.stringify({ status: 200, body: 'OK' }),
        'EX',
        3600,
      );
    });

    it('should succeed when Redis write fails (DB write already committed)', async () => {
      prisma.idempotencyKey.upsert.mockResolvedValue({});
      mockRedisSet.mockRejectedValue(new Error('ECONNREFUSED'));

      // Should not throw
      await expect(
        service.store('msg-123', { status: 200, body: 'OK' }, 60),
      ).resolves.toBeUndefined();
      expect(prisma.idempotencyKey.upsert).toHaveBeenCalledTimes(1);
    });

    it('should propagate DB write errors (DB is authoritative)', async () => {
      prisma.idempotencyKey.upsert.mockRejectedValue(new Error('DB connection failed'));

      await expect(service.store('msg-123', { status: 200, body: 'OK' }, 60)).rejects.toThrow(
        'DB connection failed',
      );
      expect(mockRedisSet).not.toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('should disconnect Redis on module destroy', () => {
      service.onModuleDestroy();
      expect(mockRedisDisconnect).toHaveBeenCalledTimes(1);
    });
  });
});
