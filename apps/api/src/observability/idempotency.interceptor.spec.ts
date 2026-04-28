import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { IdempotencyInterceptor } from './idempotency.interceptor';

function makeContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('IdempotencyInterceptor', () => {
  it('bypasses requests without an idempotency key', async () => {
    const prisma = {
      idempotencyKey: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };
    const interceptor = new IdempotencyInterceptor(prisma as never);
    const next: CallHandler = { handle: jest.fn(() => of({ data: { id: 'log_1' } })) };

    const result = await lastValueFrom(
      interceptor.intercept(
        makeContext({
          method: 'POST',
          path: '/meal-logs',
          user: { id: 'user_1' },
          header: jest.fn(),
        }),
        next,
      ),
    );

    expect(result).toEqual({ data: { id: 'log_1' } });
    expect(next.handle).toHaveBeenCalledTimes(1);
    expect(prisma.idempotencyKey.findUnique).not.toHaveBeenCalled();
  });

  it('returns a cached response for duplicate keyed writes', async () => {
    const cached = { data: { id: 'log_cached' } };
    const prisma = {
      idempotencyKey: {
        findUnique: jest.fn().mockResolvedValue({
          responseBody: cached,
          expiresAt: new Date(Date.now() + 60_000),
        }),
        create: jest.fn(),
      },
    };
    const interceptor = new IdempotencyInterceptor(prisma as never);
    const next: CallHandler = { handle: jest.fn(() => of({ data: { id: 'log_new' } })) };

    const result = await lastValueFrom(
      interceptor.intercept(
        makeContext({
          method: 'POST',
          path: '/meal-logs',
          user: { id: 'user_1' },
          header: jest.fn((name: string) => (name === 'idempotency-key' ? 'queue_1' : undefined)),
        }),
        next,
      ),
    );

    expect(result).toEqual(cached);
    expect(next.handle).not.toHaveBeenCalled();
    expect(prisma.idempotencyKey.create).not.toHaveBeenCalled();
  });

  it('stores successful keyed write responses', async () => {
    const response = { data: { id: 'log_1' } };
    const prisma = {
      idempotencyKey: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const interceptor = new IdempotencyInterceptor(prisma as never);
    const next: CallHandler = { handle: jest.fn(() => of(response)) };

    const result = await lastValueFrom(
      interceptor.intercept(
        makeContext({
          method: 'POST',
          path: '/meal-logs',
          user: { id: 'user_1' },
          header: jest.fn((name: string) => (name === 'idempotency-key' ? 'queue_1' : undefined)),
        }),
        next,
      ),
    );

    expect(result).toEqual(response);
    expect(prisma.idempotencyKey.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        externalSystem: 'mobile_offline_write',
        externalEventId: 'user_1:POST:/meal-logs:queue_1',
        responseBody: response,
      }),
    });
  });
});
