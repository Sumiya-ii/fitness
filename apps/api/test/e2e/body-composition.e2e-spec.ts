import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { BodyCompositionController } from '../../src/body-composition/body-composition.controller';
import { BodyCompositionService } from '../../src/body-composition/body-composition.service';
import { FakeAuthGuard, createTestApp, url, TEST_USER } from './setup';

describe('Body Composition (e2e)', () => {
  let app: INestApplication;

  const mockMeasurement = {
    id: 'bc-1',
    waistCm: 85,
    neckCm: 38,
    hipCm: null,
    bodyFatPercent: 18.5,
    leanMassKg: 61.2,
    loggedAt: '2025-06-15T00:00:00Z',
  };

  const mockService = {
    logMeasurement: jest.fn().mockResolvedValue(mockMeasurement),
    getLatest: jest.fn().mockResolvedValue(mockMeasurement),
    getHistory: jest.fn().mockResolvedValue([mockMeasurement]),
    getWeeklyBudget: jest.fn().mockResolvedValue({ weeklyBudgetKcal: 3500, dailyDeficit: 500 }),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [BodyCompositionController],
      providers: [
        { provide: BodyCompositionService, useValue: mockService },
        { provide: APP_GUARD, useClass: FakeAuthGuard },
      ],
    }).compile();
    app = await createTestApp(module);
  });

  afterAll(() => app?.close());
  afterEach(() => jest.clearAllMocks());

  describe('POST /body-composition/measurements', () => {
    it('logs a measurement', () =>
      request(app.getHttpServer())
        .post(url('body-composition/measurements'))
        .send({ waistCm: 85, neckCm: 38 })
        .expect(201)
        .expect((res) => {
          expect(res.body.data).toHaveProperty('bodyFatPercent');
          expect(mockService.logMeasurement).toHaveBeenCalledWith(
            TEST_USER.id,
            expect.objectContaining({ waistCm: 85, neckCm: 38 }),
          );
        }));

    it('accepts optional hipCm', () =>
      request(app.getHttpServer())
        .post(url('body-composition/measurements'))
        .send({ waistCm: 85, neckCm: 38, hipCm: 95 })
        .expect(201));

    it('rejects waistCm below 40', () =>
      request(app.getHttpServer())
        .post(url('body-composition/measurements'))
        .send({ waistCm: 30, neckCm: 38 })
        .expect(400));

    it('rejects waistCm above 200', () =>
      request(app.getHttpServer())
        .post(url('body-composition/measurements'))
        .send({ waistCm: 210, neckCm: 38 })
        .expect(400));

    it('rejects neckCm below 20', () =>
      request(app.getHttpServer())
        .post(url('body-composition/measurements'))
        .send({ waistCm: 85, neckCm: 15 })
        .expect(400));

    it('rejects neckCm above 80', () =>
      request(app.getHttpServer())
        .post(url('body-composition/measurements'))
        .send({ waistCm: 85, neckCm: 85 })
        .expect(400));

    it('rejects hipCm below 50', () =>
      request(app.getHttpServer())
        .post(url('body-composition/measurements'))
        .send({ waistCm: 85, neckCm: 38, hipCm: 40 })
        .expect(400));

    it('rejects missing waistCm', () =>
      request(app.getHttpServer())
        .post(url('body-composition/measurements'))
        .send({ neckCm: 38 })
        .expect(400));
  });

  describe('GET /body-composition', () => {
    it('returns latest measurement', () =>
      request(app.getHttpServer())
        .get(url('body-composition'))
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveProperty('bodyFatPercent');
        }));
  });

  describe('GET /body-composition/history', () => {
    it('returns history with default 90 days', () =>
      request(app.getHttpServer())
        .get(url('body-composition/history'))
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeInstanceOf(Array);
        }));

    it('accepts days param', () =>
      request(app.getHttpServer()).get(url('body-composition/history?days=30')).expect(200));
  });

  describe('GET /body-composition/weekly-budget', () => {
    it('returns weekly budget', () =>
      request(app.getHttpServer())
        .get(url('body-composition/weekly-budget'))
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveProperty('weeklyBudgetKcal');
        }));
  });
});
