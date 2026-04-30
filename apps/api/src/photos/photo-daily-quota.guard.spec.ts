import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { PhotoDailyQuotaGuard } from './photo-daily-quota.guard';
import { ConfigService } from '../config';
import { SubscriptionsService } from '../subscriptions';

const mockRedis = {
  get: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
  disconnect: jest.fn(),
  on: jest.fn(),
};

jest.mock('ioredis', () => jest.fn().mockImplementation(() => mockRedis));

function makeContext(userId: string, requestId = 'req-1'): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user: { id: userId }, requestId }),
    }),
  } as unknown as ExecutionContext;
}

describe('PhotoDailyQuotaGuard', () => {
  let guard: PhotoDailyQuotaGuard;
  let subscriptions: { checkEntitlement: jest.Mock };
  let config: { get: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    config = { get: jest.fn().mockReturnValue('redis://localhost:6379') };
    subscriptions = { checkEntitlement: jest.fn().mockResolvedValue('free') };
    guard = new PhotoDailyQuotaGuard(
      config as unknown as ConfigService,
      subscriptions as unknown as SubscriptionsService,
    );
  });

  describe('free user (cap = 50)', () => {
    it('allows request when count is below cap', async () => {
      mockRedis.get.mockResolvedValue('10');
      mockRedis.incr.mockResolvedValue(11);
      const result = await guard.canActivate(makeContext('user-1'));
      expect(result).toBe(true);
    });

    it('throws 429 when count equals cap', async () => {
      mockRedis.get.mockResolvedValue('50');
      await expect(guard.canActivate(makeContext('user-1'))).rejects.toThrow(HttpException);
      await expect(guard.canActivate(makeContext('user-1'))).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
    });

    it('throws 429 when count exceeds cap', async () => {
      mockRedis.get.mockResolvedValue('99');
      await expect(guard.canActivate(makeContext('user-1'))).rejects.toThrow(HttpException);
    });
  });

  describe('pro user (cap = 200)', () => {
    beforeEach(() => {
      subscriptions.checkEntitlement.mockResolvedValue('pro');
    });

    it('allows request at count 199', async () => {
      mockRedis.get.mockResolvedValue('199');
      mockRedis.incr.mockResolvedValue(200);
      const result = await guard.canActivate(makeContext('user-1'));
      expect(result).toBe(true);
    });

    it('throws 429 when count equals 200', async () => {
      mockRedis.get.mockResolvedValue('200');
      await expect(guard.canActivate(makeContext('user-1'))).rejects.toThrow(HttpException);
    });
  });

  it('sets TTL on the first write (incr returns 1)', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.incr.mockResolvedValue(1);
    await guard.canActivate(makeContext('user-1'));
    expect(mockRedis.expire).toHaveBeenCalledWith(
      expect.stringMatching(/^photo_quota:user-1:/),
      expect.any(Number),
    );
  });

  it('does not set TTL on subsequent writes (incr > 1)', async () => {
    mockRedis.get.mockResolvedValue('5');
    mockRedis.incr.mockResolvedValue(6);
    await guard.canActivate(makeContext('user-1'));
    expect(mockRedis.expire).not.toHaveBeenCalled();
  });

  it('fails open when Redis is unavailable for get', async () => {
    mockRedis.get.mockRejectedValue(new Error('ECONNREFUSED'));
    const result = await guard.canActivate(makeContext('user-1'));
    expect(result).toBe(true);
  });

  it('returns true when no user on request (auth guard handles it)', async () => {
    const ctx = {
      switchToHttp: () => ({ getRequest: () => ({ user: undefined }) }),
    } as unknown as ExecutionContext;
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('includes requestId in the 429 response body', async () => {
    mockRedis.get.mockResolvedValue('50');
    try {
      await guard.canActivate(makeContext('user-1', 'req-abc'));
      fail('should have thrown');
    } catch (err) {
      expect((err as HttpException).getResponse()).toMatchObject({ requestId: 'req-abc' });
    }
  });
});
