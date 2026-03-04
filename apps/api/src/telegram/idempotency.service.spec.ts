import { IdempotencyService } from './idempotency.service';
import { PrismaService } from '../prisma';

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let prisma: Record<string, Record<string, jest.Mock>>;

  beforeEach(() => {
    prisma = {
      idempotencyKey: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };
    service = new IdempotencyService(prisma as unknown as PrismaService);
  });

  describe('check', () => {
    it('should return exists: false when key not found', async () => {
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

    it('should return exists: false when key is expired', async () => {
      prisma.idempotencyKey.findUnique.mockResolvedValue({
        externalEventId: 'msg-123',
        expiresAt: new Date('2020-01-01'),
        responseStatus: 200,
        responseBody: { message: 'cached' },
      });

      const result = await service.check('msg-123');

      expect(result.exists).toBe(false);
    });

    it('should return cached response when key exists and not expired', async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);
      prisma.idempotencyKey.findUnique.mockResolvedValue({
        externalEventId: 'msg-123',
        expiresAt: futureDate,
        responseStatus: 200,
        responseBody: 'Logged: rice 200 cal',
      });

      const result = await service.check('msg-123');

      expect(result.exists).toBe(true);
      expect(result.response).toEqual({
        status: 200,
        body: 'Logged: rice 200 cal',
      });
    });
  });

  describe('store', () => {
    it('should upsert idempotency key with response and TTL', async () => {
      prisma.idempotencyKey.upsert.mockResolvedValue({});

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
    });
  });
});
