import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { ProfileController } from '../../src/profile/profile.controller';
import { ProfileService } from '../../src/profile/profile.service';
import { FakeAuthGuard, createTestApp, url, TEST_USER } from './setup';

describe('Profile (e2e)', () => {
  let app: INestApplication;

  const mockProfile = {
    id: TEST_USER.id,
    displayName: 'Tester',
    locale: 'mn',
    unitSystem: 'metric',
    gender: 'male',
    birthDate: '1990-01-01',
    heightCm: 175,
    weightKg: 70,
    bmi: 22.9,
    goalWeightKg: 65,
    activityLevel: 'moderate',
    dietPreference: 'standard',
  };

  const mockProfileService = {
    getProfile: jest.fn().mockResolvedValue(mockProfile),
    updateProfile: jest.fn().mockResolvedValue({ ...mockProfile, displayName: 'Updated' }),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ProfileController],
      providers: [
        { provide: ProfileService, useValue: mockProfileService },
        { provide: APP_GUARD, useClass: FakeAuthGuard },
      ],
    }).compile();
    app = await createTestApp(module);
  });

  afterAll(() => app?.close());
  afterEach(() => jest.clearAllMocks());

  describe('GET /profile', () => {
    it('returns user profile', () =>
      request(app.getHttpServer())
        .get(url('profile'))
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toMatchObject({
            displayName: 'Tester',
            locale: 'mn',
            unitSystem: 'metric',
          });
          expect(mockProfileService.getProfile).toHaveBeenCalledWith(TEST_USER.id);
        }));
  });

  describe('PUT /profile', () => {
    it('updates profile with valid data', () =>
      request(app.getHttpServer())
        .put(url('profile'))
        .send({ displayName: 'Updated', locale: 'en' })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.displayName).toBe('Updated');
          expect(mockProfileService.updateProfile).toHaveBeenCalledWith(
            TEST_USER.id,
            expect.objectContaining({ displayName: 'Updated', locale: 'en' }),
          );
        }));

    it('rejects invalid locale', () =>
      request(app.getHttpServer()).put(url('profile')).send({ locale: 'fr' }).expect(400));

    it('rejects invalid gender', () =>
      request(app.getHttpServer()).put(url('profile')).send({ gender: 'alien' }).expect(400));

    it('rejects underage birthDate', () =>
      request(app.getHttpServer())
        .put(url('profile'))
        .send({ birthDate: '2020-01-01' })
        .expect(400));

    it('rejects heightCm out of range', () =>
      request(app.getHttpServer()).put(url('profile')).send({ heightCm: 5 }).expect(400));

    it('rejects weightKg out of range', () =>
      request(app.getHttpServer()).put(url('profile')).send({ weightKg: 600 }).expect(400));

    it('accepts empty body (partial update)', () =>
      request(app.getHttpServer()).put(url('profile')).send({}).expect(200));
  });
});
