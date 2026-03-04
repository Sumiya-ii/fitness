import { BadRequestException } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

describe('ProfileController', () => {
  let controller: ProfileController;
  let profileService: Partial<ProfileService>;

  const mockUser = {
    id: 'user-uuid',
    firebaseUid: 'firebase-123',
    email: 'test@example.com',
    phone: null,
  };

  const mockProfile = {
    id: 'profile-uuid',
    userId: 'user-uuid',
    displayName: 'Test',
    locale: 'mn',
    unitSystem: 'metric',
    gender: null,
    birthDate: null,
    heightCm: null,
    activityLevel: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    profileService = {
      getProfile: jest.fn().mockResolvedValue(mockProfile),
      updateProfile: jest.fn().mockResolvedValue(mockProfile),
    };
    controller = new ProfileController(profileService as ProfileService);
  });

  it('should get profile', async () => {
    const result = await controller.getProfile(mockUser);
    expect(result.data).toEqual(mockProfile);
    expect(profileService.getProfile).toHaveBeenCalledWith('user-uuid');
  });

  it('should update profile with valid data', async () => {
    await controller.updateProfile(mockUser, { locale: 'en' });
    expect(profileService.updateProfile).toHaveBeenCalledWith('user-uuid', { locale: 'en' });
  });

  it('should reject invalid locale', async () => {
    await expect(
      controller.updateProfile(mockUser, { locale: 'invalid' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject invalid unitSystem', async () => {
    await expect(
      controller.updateProfile(mockUser, { unitSystem: 'banana' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject heightCm out of range', async () => {
    await expect(
      controller.updateProfile(mockUser, { heightCm: 10 }),
    ).rejects.toThrow(BadRequestException);
  });
});
