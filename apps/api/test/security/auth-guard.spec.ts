/**
 * C-037: Security/Privacy Verification Pack
 * Verifies auth guard blocks unauthenticated requests, allows public routes, validates tokens.
 */
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '../../src/auth/auth.guard';
import { FirebaseProvider } from '../../src/auth/firebase.provider';
import { AuthService } from '../../src/auth/auth.service';

describe('Security: Auth Guard', () => {
  let guard: AuthGuard;
  let firebase: Partial<FirebaseProvider>;
  let authService: Partial<AuthService>;
  let reflector: Partial<Reflector>;

  beforeEach(() => {
    firebase = { verifyToken: jest.fn() };
    authService = { findOrCreateUser: jest.fn() };
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    guard = new AuthGuard(
      firebase as FirebaseProvider,
      authService as AuthService,
      reflector as Reflector,
    );
  });

  function createMockContext(authHeader?: string): ExecutionContext {
    const request = { headers: { authorization: authHeader } };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  }

  it('should block unauthenticated requests', async () => {
    const ctx = createMockContext();
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should allow public routes', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);
    const ctx = createMockContext();
    expect(await guard.canActivate(ctx)).toBe(true);
  });

  it('should validate tokens and reject invalid ones', async () => {
    (firebase.verifyToken as jest.Mock).mockRejectedValue(new Error('invalid'));
    const ctx = createMockContext('Bearer invalid-token');
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should accept valid Bearer token and set user on request', async () => {
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

  it('should reject non-Bearer auth headers', async () => {
    const ctx = createMockContext('Basic dXNlcjpwYXNz');
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
});
