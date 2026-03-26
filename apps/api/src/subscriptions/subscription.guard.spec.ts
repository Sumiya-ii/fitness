import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { SubscriptionGuard } from './subscription.guard';
import { SubscriptionsService } from './subscriptions.service';

function makeContext(userId: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user: { id: userId } }),
    }),
  } as unknown as ExecutionContext;
}

describe('SubscriptionGuard', () => {
  let guard: SubscriptionGuard;
  let service: { checkEntitlement: jest.Mock };

  beforeEach(() => {
    service = { checkEntitlement: jest.fn() };
    guard = new SubscriptionGuard(service as unknown as SubscriptionsService);
  });

  it('allows a pro user', async () => {
    service.checkEntitlement.mockResolvedValue('pro');
    await expect(guard.canActivate(makeContext('user-1'))).resolves.toBe(true);
    expect(service.checkEntitlement).toHaveBeenCalledWith('user-1');
  });

  it('throws ForbiddenException for a free user', async () => {
    service.checkEntitlement.mockResolvedValue('free');
    await expect(guard.canActivate(makeContext('user-2'))).rejects.toThrow(ForbiddenException);
  });
});
