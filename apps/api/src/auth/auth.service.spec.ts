import { AuthService } from './auth.service';
import { PrismaService } from '../prisma';
import type { DecodedIdToken } from 'firebase-admin/auth';

// ── helpers ──────────────────────────────────────────────────────────────────

function buildDecoded(overrides: Partial<DecodedIdToken> = {}): DecodedIdToken {
  return {
    uid: 'firebase-123',
    email: 'test@example.com',
    phone_number: '+97699001234',
    firebase: { sign_in_provider: 'password', identities: {} },
    iss: 'https://securetoken.google.com/project',
    aud: 'project',
    auth_time: 0,
    sub: 'firebase-123',
    iat: 0,
    exp: 9999999999,
    ...overrides,
  } as DecodedIdToken;
}

// ── suite ─────────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };
    service = new AuthService(prisma as unknown as PrismaService);
  });

  // ── findOrCreateUser — existing user ──────────────────────────────────────

  describe('when user already exists in the database', () => {
    it('should return the existing user without creating a new record', async () => {
      const existing = {
        id: 'user-uuid',
        firebaseUid: 'firebase-123',
        email: 'test@example.com',
        phone: '+97699001234',
      };
      prisma.user.findUnique.mockResolvedValue(existing);

      const result = await service.findOrCreateUser(buildDecoded());

      expect(result).toEqual(existing);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('should look up the user by firebaseUid', async () => {
      const existing = {
        id: 'user-uuid',
        firebaseUid: 'firebase-123',
        email: 'test@example.com',
        phone: null,
      };
      prisma.user.findUnique.mockResolvedValue(existing);

      await service.findOrCreateUser(buildDecoded({ uid: 'firebase-123' }));

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { firebaseUid: 'firebase-123' },
      });
    });
  });

  // ── findOrCreateUser — new user ───────────────────────────────────────────

  describe('when user does not yet exist', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue(null);
    });

    it('should create a new user with a default profile and free subscription', async () => {
      const created = {
        id: 'new-user-uuid',
        firebaseUid: 'firebase-123',
        email: 'test@example.com',
        phone: '+97699001234',
      };
      prisma.user.create.mockResolvedValue(created);

      const result = await service.findOrCreateUser(buildDecoded());

      expect(result.id).toBe('new-user-uuid');
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            firebaseUid: 'firebase-123',
            email: 'test@example.com',
            phone: '+97699001234',
            profile: {
              create: { locale: 'mn', unitSystem: 'metric' },
            },
            subscription: {
              create: { tier: 'free', status: 'active' },
            },
          }),
        }),
      );
    });

    it('should create a user with null email when Apple hides the email', async () => {
      // Apple Sign-In allows users to hide their real email address.
      // decoded.email will be undefined in that case.
      const decoded = buildDecoded({
        uid: 'apple-uid-001',
        email: undefined,
        firebase: { sign_in_provider: 'apple.com', identities: {} },
      });
      const created = {
        id: 'apple-user-uuid',
        firebaseUid: 'apple-uid-001',
        email: null,
        phone: null,
      };
      prisma.user.create.mockResolvedValue(created);

      const result = await service.findOrCreateUser(decoded);

      expect(result.email).toBeNull();
      const createCall = prisma.user.create.mock.calls[0][0] as {
        data: { email: null | undefined };
      };
      expect(createCall.data.email).toBeNull();
    });

    it('should create a user with null phone when phone_number is absent', async () => {
      const decoded = buildDecoded({ phone_number: undefined });
      const created = {
        id: 'user-no-phone',
        firebaseUid: 'firebase-123',
        email: 'test@example.com',
        phone: null,
      };
      prisma.user.create.mockResolvedValue(created);

      const result = await service.findOrCreateUser(decoded);

      expect(result.phone).toBeNull();
      const createCall = prisma.user.create.mock.calls[0][0] as {
        data: { phone: null | undefined };
      };
      expect(createCall.data.phone).toBeNull();
    });

    it('should create a user when sign_in_provider is apple.com', async () => {
      const decoded = buildDecoded({
        uid: 'apple-uid-002',
        email: 'privateRelay@privaterelay.appleid.com',
        firebase: { sign_in_provider: 'apple.com', identities: {} },
      });
      const created = {
        id: 'apple-user-uuid-2',
        firebaseUid: 'apple-uid-002',
        email: 'privateRelay@privaterelay.appleid.com',
        phone: null,
      };
      prisma.user.create.mockResolvedValue(created);

      const result = await service.findOrCreateUser(decoded);

      expect(result.firebaseUid).toBe('apple-uid-002');
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ firebaseUid: 'apple-uid-002' }),
        }),
      );
    });

    it('should throw when the database rejects the user creation', async () => {
      const dbError = new Error('unique constraint violation');
      prisma.user.create.mockRejectedValue(dbError);

      await expect(service.findOrCreateUser(buildDecoded())).rejects.toThrow(
        'unique constraint violation',
      );
    });

    it('should propagate database error without wrapping it in a different error type', async () => {
      const dbError = new Error('Connection refused');
      prisma.user.create.mockRejectedValue(dbError);

      try {
        await service.findOrCreateUser(buildDecoded());
        fail('expected an error to be thrown');
      } catch (err) {
        expect(err).toBe(dbError);
      }
    });
  });

  // ── findOrCreateUser — race / concurrent creation ─────────────────────────

  describe('race condition: concurrent first-login requests', () => {
    it('should handle the case where findUnique returns null but create throws a unique-constraint error', async () => {
      // Simulates two simultaneous requests: both read null, first succeeds,
      // second hits a unique-constraint violation from the DB.
      prisma.user.findUnique.mockResolvedValue(null);
      const uniqueError = Object.assign(
        new Error('Unique constraint failed on field firebaseUid'),
        {
          code: 'P2002',
        },
      );
      prisma.user.create.mockRejectedValue(uniqueError);

      await expect(service.findOrCreateUser(buildDecoded())).rejects.toThrow(
        'Unique constraint failed on field firebaseUid',
      );
    });
  });

  // ── shape of AuthenticatedUser ────────────────────────────────────────────

  describe('return value shape', () => {
    it('should return only id, firebaseUid, email, and phone — no extra DB fields', async () => {
      const dbRow = {
        id: 'user-uuid',
        firebaseUid: 'firebase-123',
        email: 'test@example.com',
        phone: '+97699001234',
        createdAt: new Date(), // should NOT appear on the return value
        updatedAt: new Date(), // should NOT appear on the return value
      };
      prisma.user.findUnique.mockResolvedValue(dbRow);

      const result = await service.findOrCreateUser(buildDecoded());

      expect(Object.keys(result)).toEqual(['id', 'firebaseUid', 'email', 'phone']);
    });
  });
});
