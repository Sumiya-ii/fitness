import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from './auth.guard';
import { FirebaseProvider } from './firebase.provider';
import { AuthService } from './auth.service';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let firebase: Partial<FirebaseProvider>;
  let authService: Partial<AuthService>;
  let reflector: Partial<Reflector>;

  beforeEach(() => {
    firebase = {
      verifyToken: jest.fn(),
    };
    authService = {
      findOrCreateUser: jest.fn(),
    };
    reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    };
    guard = new AuthGuard(
      firebase as FirebaseProvider,
      authService as AuthService,
      reflector as Reflector,
    );
  });

  function createMockContext(authHeader?: string): ExecutionContext {
    const request = {
      headers: { authorization: authHeader },
    };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  }

  it('should allow public routes', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);
    const ctx = createMockContext();
    expect(await guard.canActivate(ctx)).toBe(true);
  });

  it('should reject missing token', async () => {
    const ctx = createMockContext();
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should reject invalid token', async () => {
    (firebase.verifyToken as jest.Mock).mockRejectedValue(new Error('invalid'));
    const ctx = createMockContext('Bearer invalid-token');
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should accept valid token and set user', async () => {
    const decoded = { uid: 'firebase-123', email: 'test@example.com' };
    const user = {
      id: 'user-uuid',
      firebaseUid: 'firebase-123',
      email: 'test@example.com',
      phone: null,
    };
    (firebase.verifyToken as jest.Mock).mockResolvedValue(decoded);
    (authService.findOrCreateUser as jest.Mock).mockResolvedValue(user);

    const ctx = createMockContext('Bearer valid-token');
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(firebase.verifyToken).toHaveBeenCalledWith('valid-token');
    expect(authService.findOrCreateUser).toHaveBeenCalledWith(decoded);
  });

  it('should ignore non-Bearer auth headers', async () => {
    const ctx = createMockContext('Basic dXNlcjpwYXNz');
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
});
