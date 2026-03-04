import { NotFoundException } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { PrismaService } from '../prisma';

describe('ProfileService', () => {
  let service: ProfileService;
  let prisma: {
    profile: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  const mockProfile = {
    id: 'profile-uuid',
    userId: 'user-uuid',
    displayName: 'Test User',
    locale: 'mn',
    unitSystem: 'metric',
    gender: 'male',
    birthDate: new Date('1990-05-15'),
    heightCm: { toString: () => '175.0' },
    activityLevel: 'moderately_active',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
  };

  beforeEach(() => {
    prisma = {
      profile: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new ProfileService(prisma as unknown as PrismaService);
  });

  describe('getProfile', () => {
    it('should return formatted profile', async () => {
      prisma.profile.findUnique.mockResolvedValue(mockProfile);

      const result = await service.getProfile('user-uuid');
      expect(result.userId).toBe('user-uuid');
      expect(result.locale).toBe('mn');
      expect(result.unitSystem).toBe('metric');
      expect(result.birthDate).toBe('1990-05-15');
      expect(result.heightCm).toBe(175);
    });

    it('should throw NotFoundException if profile missing', async () => {
      prisma.profile.findUnique.mockResolvedValue(null);
      await expect(service.getProfile('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('should update locale', async () => {
      prisma.profile.update.mockResolvedValue({ ...mockProfile, locale: 'en' });

      const result = await service.updateProfile('user-uuid', { locale: 'en' });
      expect(result.locale).toBe('en');
      expect(prisma.profile.update).toHaveBeenCalledWith({
        where: { userId: 'user-uuid' },
        data: { locale: 'en' },
      });
    });

    it('should update unitSystem', async () => {
      prisma.profile.update.mockResolvedValue({ ...mockProfile, unitSystem: 'imperial' });

      const result = await service.updateProfile('user-uuid', { unitSystem: 'imperial' });
      expect(result.unitSystem).toBe('imperial');
    });

    it('should update multiple fields at once', async () => {
      prisma.profile.update.mockResolvedValue({
        ...mockProfile,
        displayName: 'New Name',
        gender: 'female',
      });

      await service.updateProfile('user-uuid', {
        displayName: 'New Name',
        gender: 'female',
      });

      expect(prisma.profile.update).toHaveBeenCalledWith({
        where: { userId: 'user-uuid' },
        data: { displayName: 'New Name', gender: 'female' },
      });
    });
  });
});
