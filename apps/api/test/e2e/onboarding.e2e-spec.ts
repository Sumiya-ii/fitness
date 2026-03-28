import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { OnboardingController } from '../../src/onboarding/onboarding.controller';
import { OnboardingService } from '../../src/onboarding/onboarding.service';
import { FakeAuthGuard, createTestApp, url, TEST_USER } from './setup';

describe('Onboarding (e2e)', () => {
  let app: INestApplication;

  const mockResult = {
    profile: { id: TEST_USER.id, heightCm: 175, weightKg: 75 },
    target: { calorieTarget: 2000, proteinTarget: 150 },
  };

  const mockService = {
    completeOnboarding: jest.fn().mockResolvedValue(mockResult),
    getOnboardingStatus: jest
      .fn()
      .mockResolvedValue({ completed: true, completedAt: '2025-06-15T00:00:00Z' }),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [OnboardingController],
      providers: [
        { provide: OnboardingService, useValue: mockService },
        { provide: APP_GUARD, useClass: FakeAuthGuard },
      ],
    }).compile();
    app = await createTestApp(module);
  });

  afterAll(() => app?.close());
  afterEach(() => jest.clearAllMocks());

  const validBody = {
    goalType: 'lose_fat',
    goalWeightKg: 65,
    weeklyRateKg: 0.5,
    gender: 'male',
    birthDate: '1990-05-15',
    heightCm: 175,
    weightKg: 75,
    activityLevel: 'moderately_active',
    dietPreference: 'standard',
  };

  describe('POST /onboarding/complete', () => {
    it('completes onboarding with valid data', () =>
      request(app.getHttpServer())
        .post(url('onboarding/complete'))
        .send(validBody)
        .expect(201)
        .expect((res) => {
          expect(res.body.data).toHaveProperty('profile');
          expect(res.body.data).toHaveProperty('target');
        }));

    it('rejects missing goalType', () =>
      request(app.getHttpServer())
        .post(url('onboarding/complete'))
        .send({ ...validBody, goalType: undefined })
        .expect(400));

    it('rejects invalid gender', () =>
      request(app.getHttpServer())
        .post(url('onboarding/complete'))
        .send({ ...validBody, gender: 'robot' })
        .expect(400));

    it('rejects underage user (< 13)', () =>
      request(app.getHttpServer())
        .post(url('onboarding/complete'))
        .send({ ...validBody, birthDate: '2020-01-01' })
        .expect(400));

    it('rejects heightCm below 50', () =>
      request(app.getHttpServer())
        .post(url('onboarding/complete'))
        .send({ ...validBody, heightCm: 30 })
        .expect(400));

    it('rejects heightCm above 300', () =>
      request(app.getHttpServer())
        .post(url('onboarding/complete'))
        .send({ ...validBody, heightCm: 350 })
        .expect(400));

    it('rejects goalWeightKg below 20', () =>
      request(app.getHttpServer())
        .post(url('onboarding/complete'))
        .send({ ...validBody, goalWeightKg: 10 })
        .expect(400));

    it('rejects weeklyRateKg above 1.5', () =>
      request(app.getHttpServer())
        .post(url('onboarding/complete'))
        .send({ ...validBody, weeklyRateKg: 2 })
        .expect(400));

    it('rejects invalid activityLevel', () =>
      request(app.getHttpServer())
        .post(url('onboarding/complete'))
        .send({ ...validBody, activityLevel: 'extreme' })
        .expect(400));

    it('rejects invalid dietPreference', () =>
      request(app.getHttpServer())
        .post(url('onboarding/complete'))
        .send({ ...validBody, dietPreference: 'carnivore' })
        .expect(400));

    it('rejects empty body', () =>
      request(app.getHttpServer()).post(url('onboarding/complete')).send({}).expect(400));
  });

  describe('GET /onboarding/status', () => {
    it('returns onboarding status', () =>
      request(app.getHttpServer())
        .get(url('onboarding/status'))
        .expect(200)
        .expect((res) => {
          expect(res.body.data.completed).toBe(true);
          expect(res.body.data).toHaveProperty('completedAt');
        }));
  });
});
