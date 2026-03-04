import { AuthService } from './auth.service';
import { PrismaService } from '../prisma';
import type { DecodedIdToken } from 'firebase-admin/auth';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };
    service = new AuthService(prisma as unknown as PrismaService);
  });

  const decoded = {
    uid: 'firebase-123',
    email: 'test@example.com',
    phone_number: '+97699001234',
  } as DecodedIdToken;

  it('should return existing user', async () => {
    const existing = {
      id: 'user-uuid',
      firebaseUid: 'firebase-123',
      email: 'test@example.com',
      phone: '+97699001234',
    };
    prisma.user.findUnique.mockResolvedValue(existing);

    const result = await service.findOrCreateUser(decoded);
    expect(result).toEqual(existing);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('should create new user with profile and subscription on first login', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const created = {
      id: 'new-user-uuid',
      firebaseUid: 'firebase-123',
      email: 'test@example.com',
      phone: '+97699001234',
    };
    prisma.user.create.mockResolvedValue(created);

    const result = await service.findOrCreateUser(decoded);

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
});
