import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { ConfigService } from '../config';

describe('AdminGuard', () => {
  function mockContext(userId?: string): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user: userId ? { id: userId } : undefined,
        }),
      }),
    } as unknown as ExecutionContext;
  }

  it('allows configured admin users', () => {
    const config = { adminUserIds: ['admin-1'] } as ConfigService;
    const guard = new AdminGuard(config);

    expect(guard.canActivate(mockContext('admin-1'))).toBe(true);
  });

  it('blocks authenticated users who are not admins', () => {
    const config = { adminUserIds: ['admin-1'] } as ConfigService;
    const guard = new AdminGuard(config);

    expect(() => guard.canActivate(mockContext('user-1'))).toThrow(
      ForbiddenException,
    );
  });

  it('blocks when auth user is missing', () => {
    const config = { adminUserIds: ['admin-1'] } as ConfigService;
    const guard = new AdminGuard(config);

    expect(() => guard.canActivate(mockContext())).toThrow(ForbiddenException);
  });
});
