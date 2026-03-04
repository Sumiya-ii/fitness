/**
 * C-036: Reliability Test Pack (NFR-010..012)
 * Verifies IdempotencyService correctly prevents duplicate processing.
 */
import { IdempotencyService } from '../../src/telegram/idempotency.service';
import { PrismaService } from '../../src/prisma';

describe('Reliability: Idempotency (NFR-010..012)', () => {
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

  describe('duplicate prevention', () => {
    it('should return cached response when key exists and not expired', async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);
      prisma.idempotencyKey.findUnique.mockResolvedValue({
        externalEventId: 'msg-456',
        expiresAt: futureDate,
        responseStatus: 200,
        responseBody: { logged: true },
      });

      const result = await service.check('msg-456');

      expect(result.exists).toBe(true);
      expect(result.response).toEqual({ status: 200, body: { logged: true } });
    });

    it('should return exists: false when key not found - allowing first processing', async () => {
      prisma.idempotencyKey.findUnique.mockResolvedValue(null);

      const result = await service.check('msg-first');

      expect(result.exists).toBe(false);
      expect(result.response).toBeUndefined();
    });

    it('should return exists: false when key is expired - allowing reprocessing', async () => {
      prisma.idempotencyKey.findUnique.mockResolvedValue({
        externalEventId: 'msg-expired',
        expiresAt: new Date('2020-01-01'),
        responseStatus: 200,
        responseBody: {},
      });

      const result = await service.check('msg-expired');

      expect(result.exists).toBe(false);
    });
  });

  describe('store', () => {
    it('should store idempotency key to prevent duplicate processing on replay', async () => {
      prisma.idempotencyKey.upsert.mockResolvedValue({});

      await service.store('msg-789', { status: 200, body: { id: 'log-1' } }, 60);

      expect(prisma.idempotencyKey.upsert).toHaveBeenCalledWith({
        where: {
          externalSystem_externalEventId: {
            externalSystem: 'telegram',
            externalEventId: 'msg-789',
          },
        },
        create: expect.objectContaining({
          externalSystem: 'telegram',
          externalEventId: 'msg-789',
          responseStatus: 200,
          responseBody: { id: 'log-1' },
        }),
        update: expect.objectContaining({
          responseStatus: 200,
          responseBody: { id: 'log-1' },
        }),
      });
    });
  });
});
