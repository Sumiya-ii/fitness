import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { TargetsController } from '../../src/targets/targets.controller';
import { TargetsService } from '../../src/targets/targets.service';
import { FakeAuthGuard, createTestApp, url, TEST_USER } from './setup';

describe('Targets (e2e)', () => {
  let app: INestApplication;

  const mockTarget = {
    id: 'target-1',
    goalType: 'lose_fat',
    calorieTarget: 1800,
    proteinTarget: 140,
    carbsTarget: 180,
    fatTarget: 60,
    weeklyRateKg: 0.5,
    weightKg: 75,
    createdAt: '2025-06-15T00:00:00Z',
  };

  const mockService = {
    createTarget: jest.fn().mockResolvedValue(mockTarget),
    getCurrentTarget: jest.fn().mockResolvedValue(mockTarget),
    getTargetHistory: jest.fn().mockResolvedValue([mockTarget]),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TargetsController],
      providers: [
        { provide: TargetsService, useValue: mockService },
        { provide: APP_GUARD, useClass: FakeAuthGuard },
      ],
    }).compile();
    app = await createTestApp(module);
  });

  afterAll(() => app?.close());
  afterEach(() => jest.clearAllMocks());

  describe('POST /targets', () => {
    it('creates a target', () =>
      request(app.getHttpServer())
        .post(url('targets'))
        .send({ goalType: 'lose_fat', weeklyRateKg: 0.5, weightKg: 75 })
        .expect(201)
        .expect((res) => {
          expect(res.body.data.goalType).toBe('lose_fat');
          expect(res.body.data).toHaveProperty('calorieTarget');
        }));

    it('rejects invalid goalType', () =>
      request(app.getHttpServer())
        .post(url('targets'))
        .send({ goalType: 'fly', weeklyRateKg: 0.5, weightKg: 75 })
        .expect(400));

    it('rejects weeklyRateKg above 1.5', () =>
      request(app.getHttpServer())
        .post(url('targets'))
        .send({ goalType: 'lose_fat', weeklyRateKg: 2.0, weightKg: 75 })
        .expect(400));

    it('rejects weightKg below 30', () =>
      request(app.getHttpServer())
        .post(url('targets'))
        .send({ goalType: 'lose_fat', weeklyRateKg: 0.5, weightKg: 10 })
        .expect(400));

    it('rejects weightKg above 500', () =>
      request(app.getHttpServer())
        .post(url('targets'))
        .send({ goalType: 'lose_fat', weeklyRateKg: 0.5, weightKg: 501 })
        .expect(400));

    it('rejects missing required fields', () =>
      request(app.getHttpServer()).post(url('targets')).send({}).expect(400));
  });

  describe('GET /targets/current', () => {
    it('returns current target', () =>
      request(app.getHttpServer())
        .get(url('targets/current'))
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveProperty('calorieTarget');
          expect(res.body.data).toHaveProperty('proteinTarget');
        }));
  });

  describe('GET /targets/history', () => {
    it('returns target history', () =>
      request(app.getHttpServer())
        .get(url('targets/history'))
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeInstanceOf(Array);
        }));
  });
});
