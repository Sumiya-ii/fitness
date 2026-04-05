import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from './auth.guard';
import { FirebaseProvider } from './firebase.provider';
import { AuthService } from './auth.service';
import type { DecodedIdToken } from 'firebase-admin/auth';

// ── helpers ──────────────────────────────────────────────────────────────────

function buildDecoded(overrides: Partial<DecodedIdToken> = {}): Partial<DecodedIdToken> {
  return {
    uid: 'firebase-123',
    email: 'test@example.com',
    firebase: { sign_in_provider: 'password', identities: {} },
    ...overrides,
  };
}

function buildUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-uuid',
    firebaseUid: 'firebase-123',
    email: 'test@example.com',
    phone: null,
    ...overrides,
  };
}

// ── suite ─────────────────────────────────────────────────────────────────────

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let firebase: Partial<FirebaseProvider>;
  let authService: Partial<AuthService>;
  let reflector: Partial<Reflector>;

  beforeEach(() => {
    jest.clearAllMocks();
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

  function createMockContextWithRequest(authHeader?: string): {
    context: ExecutionContext;
    request: Record<string, unknown>;
  } {
    const request: Record<string, unknown> = {
      headers: { authorization: authHeader },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
    return { context, request };
  }

  // ── public routes ─────────────────────────────────────────────────────────

  describe('public routes', () => {
    it('should allow public routes without any token', async () => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);
      const ctx = createMockContext();
      expect(await guard.canActivate(ctx)).toBe(true);
    });

    it('should skip token verification entirely for public routes', async () => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);
      const ctx = createMockContext();
      await guard.canActivate(ctx);
      expect(firebase.verifyToken).not.toHaveBeenCalled();
    });
  });

  // ── missing / malformed authorization header ──────────────────────────────

  describe('missing or malformed authorization header', () => {
    it('should reject requests with no authorization header', async () => {
      const ctx = createMockContext();
      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject requests with no authorization header with "Missing authorization token" message', async () => {
      const ctx = createMockContext();
      await expect(guard.canActivate(ctx)).rejects.toThrow('Missing authorization token');
    });

    it('should reject when authorization uses Basic scheme instead of Bearer', async () => {
      const ctx = createMockContext('Basic dXNlcjpwYXNz');
      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject when authorization header has only one part (no token after scheme)', async () => {
      const ctx = createMockContext('Bearer');
      // split(' ') on 'Bearer' gives ['Bearer'], token is undefined
      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject when authorization header is empty string', async () => {
      const ctx = createMockContext('');
      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── happy path ────────────────────────────────────────────────────────────

  describe('valid token', () => {
    it('should allow access and set user on request when token is valid', async () => {
      const decoded = buildDecoded();
      const user = buildUser();
      (firebase.verifyToken as jest.Mock).mockResolvedValue(decoded);
      (authService.findOrCreateUser as jest.Mock).mockResolvedValue(user);

      const { context, request } = createMockContextWithRequest('Bearer valid-token');
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(request['user']).toEqual(user);
    });

    it('should pass the extracted token (without "Bearer " prefix) to firebase.verifyToken', async () => {
      (firebase.verifyToken as jest.Mock).mockResolvedValue(buildDecoded());
      (authService.findOrCreateUser as jest.Mock).mockResolvedValue(buildUser());

      const ctx = createMockContext('Bearer the-actual-token');
      await guard.canActivate(ctx);

      expect(firebase.verifyToken).toHaveBeenCalledWith('the-actual-token');
    });

    it('should pass the decoded token to authService.findOrCreateUser', async () => {
      const decoded = buildDecoded({ uid: 'firebase-abc', email: 'abc@example.com' });
      (firebase.verifyToken as jest.Mock).mockResolvedValue(decoded);
      (authService.findOrCreateUser as jest.Mock).mockResolvedValue(buildUser());

      const ctx = createMockContext('Bearer some-token');
      await guard.canActivate(ctx);

      expect(authService.findOrCreateUser).toHaveBeenCalledWith(decoded, undefined);
    });
  });

  // ── Apple Sign-In ─────────────────────────────────────────────────────────

  describe('Apple Sign-In tokens', () => {
    it('should accept a token issued via Apple Sign-In (sign_in_provider apple.com)', async () => {
      const decoded = buildDecoded({
        uid: 'apple-uid-456',
        email: undefined,
        firebase: { sign_in_provider: 'apple.com', identities: {} },
      });
      const user = buildUser({
        firebaseUid: 'apple-uid-456',
        email: null,
      });
      (firebase.verifyToken as jest.Mock).mockResolvedValue(decoded);
      (authService.findOrCreateUser as jest.Mock).mockResolvedValue(user);

      const { context, request } = createMockContextWithRequest('Bearer apple-id-token');
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect((request['user'] as typeof user).email).toBeNull();
    });

    it('should accept a token from Apple where the user hid their email', async () => {
      const decoded = buildDecoded({
        uid: 'apple-uid-789',
        email: undefined, // email hidden by user in Apple settings
        firebase: { sign_in_provider: 'apple.com', identities: {} },
      });
      (firebase.verifyToken as jest.Mock).mockResolvedValue(decoded);
      (authService.findOrCreateUser as jest.Mock).mockResolvedValue(
        buildUser({ firebaseUid: 'apple-uid-789', email: null }),
      );

      const ctx = createMockContext('Bearer apple-no-email-token');
      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
    });
  });

  // ── Google Sign-In ────────────────────────────────────────────────────────

  describe('Google Sign-In tokens', () => {
    it('should accept a token issued via Google Sign-In (sign_in_provider google.com)', async () => {
      const decoded = buildDecoded({
        uid: 'google-uid-321',
        email: 'user@gmail.com',
        firebase: { sign_in_provider: 'google.com', identities: {} },
      });
      (firebase.verifyToken as jest.Mock).mockResolvedValue(decoded);
      (authService.findOrCreateUser as jest.Mock).mockResolvedValue(
        buildUser({ firebaseUid: 'google-uid-321', email: 'user@gmail.com' }),
      );

      const ctx = createMockContext('Bearer google-id-token');
      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
    });
  });

  // ── Firebase errors ───────────────────────────────────────────────────────

  describe('Firebase token errors', () => {
    it('should return 401 when Firebase reports the token has expired', async () => {
      const expiredError = Object.assign(new Error('Firebase ID token has expired'), {
        code: 'auth/id-token-expired',
      });
      (firebase.verifyToken as jest.Mock).mockRejectedValue(expiredError);

      const ctx = createMockContext('Bearer expired-token');
      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    it('should return 401 with "Invalid or expired token" message on token expiry', async () => {
      (firebase.verifyToken as jest.Mock).mockRejectedValue(new Error('token expired'));

      const ctx = createMockContext('Bearer expired-token');
      await expect(guard.canActivate(ctx)).rejects.toThrow('Invalid or expired token');
    });

    it('should return 401 when token is malformed / truncated', async () => {
      const malformedError = Object.assign(new Error('Decoding Firebase ID token failed'), {
        code: 'auth/argument-error',
      });
      (firebase.verifyToken as jest.Mock).mockRejectedValue(malformedError);

      const ctx = createMockContext('Bearer not.a.real.jwt');
      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    it('should return 401 when Firebase Admin SDK fails to connect to Google', async () => {
      const sdkError = new Error('Failed to fetch public keys for Google certs');
      (firebase.verifyToken as jest.Mock).mockRejectedValue(sdkError);

      const ctx = createMockContext('Bearer some-token');
      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    it('should return 401 when verifyToken times out', async () => {
      const timeoutError = new Error('network timeout');
      (firebase.verifyToken as jest.Mock).mockRejectedValue(timeoutError);

      const ctx = createMockContext('Bearer some-token');
      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    it('should not expose the internal Firebase error message in the 401 response', async () => {
      (firebase.verifyToken as jest.Mock).mockRejectedValue(
        new Error('FIREBASE_PRIVATE_KEY is invalid'),
      );

      const ctx = createMockContext('Bearer some-token');
      try {
        await guard.canActivate(ctx);
        fail('expected UnauthorizedException');
      } catch (err) {
        expect(err).toBeInstanceOf(UnauthorizedException);
        const message = (err as UnauthorizedException).message;
        expect(message).not.toContain('FIREBASE_PRIVATE_KEY');
      }
    });
  });

  // ── authService errors ────────────────────────────────────────────────────

  describe('authService errors after successful token verification', () => {
    it('should return 401 when authService.findOrCreateUser throws a database error', async () => {
      (firebase.verifyToken as jest.Mock).mockResolvedValue(buildDecoded());
      (authService.findOrCreateUser as jest.Mock).mockRejectedValue(
        new Error('Connection refused'),
      );

      const ctx = createMockContext('Bearer valid-token');
      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });
  });
});
