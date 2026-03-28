import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { WeightLogsController } from '../../src/weight-logs/weight-logs.controller';
import { WeightLogsService } from '../../src/weight-logs/weight-logs.service';
import { FakeAuthGuard, createTestApp, url, TEST_USER } from './setup';

describe('Weight Logs (e2e)', () => {
  let app: INestApplication;

  const mockWeightLog = { id: 'wl-1', weightKg: 72.5, loggedAt: '2025-06-15' };
  const mockTrend = {
    current: 72.5,
    weeklyAverage: 72.8,
    previousWeekAverage: 73.2,
    weeklyDelta: -0.4,
    dataPoints: 7,
  };

  const mockService = {
    log: jest.fn().mockResolvedValue(mockWeightLog),
    getHistory: jest.fn().mockResolvedValue([mockWeightLog]),
    getTrend: jest.fn().mockResolvedValue(mockTrend),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [WeightLogsController],
      providers: [
        { provide: WeightLogsService, useValue: mockService },
        { provide: APP_GUARD, useClass: FakeAuthGuard },
      ],
    }).compile();
    app = await createTestApp(module);
  });

  afterAll(() => app?.close());
  afterEach(() => jest.clearAllMocks());

  describe('POST /weight-logs', () => {
    it('logs a weight entry', () =>
      request(app.getHttpServer())
        .post(url('weight-logs'))
        .send({ weightKg: 72.5 })
        .expect(201)
        .expect((res) => {
          expect(res.body.data.weightKg).toBe(72.5);
          expect(mockService.log).toHaveBeenCalledWith(
            TEST_USER.id,
            expect.objectContaining({ weightKg: 72.5 }),
          );
        }));

    it('accepts loggedAt date', () =>
      request(app.getHttpServer())
        .post(url('weight-logs'))
        .send({ weightKg: 72, loggedAt: '2025-06-14' })
        .expect(201));

    it('rejects weight below 20', () =>
      request(app.getHttpServer()).post(url('weight-logs')).send({ weightKg: 10 }).expect(400));

    it('rejects weight above 500', () =>
      request(app.getHttpServer()).post(url('weight-logs')).send({ weightKg: 501 }).expect(400));

    it('rejects missing weightKg', () =>
      request(app.getHttpServer()).post(url('weight-logs')).send({}).expect(400));

    it('rejects string weightKg', () =>
      request(app.getHttpServer())
        .post(url('weight-logs'))
        .send({ weightKg: 'heavy' })
        .expect(400));
  });

  describe('GET /weight-logs', () => {
    it('returns history with default 30 days', () =>
      request(app.getHttpServer())
        .get(url('weight-logs'))
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeInstanceOf(Array);
        }));

    it('accepts days param', () =>
      request(app.getHttpServer()).get(url('weight-logs?days=60')).expect(200));

    it('clamps days to max 365', () =>
      request(app.getHttpServer())
        .get(url('weight-logs?days=1000'))
        .expect(200)
        .expect(() => {
          expect(mockService.getHistory).toHaveBeenCalledWith(TEST_USER.id, 365);
        }));
  });

  describe('GET /weight-logs/trend', () => {
    it('returns weight trend', () =>
      request(app.getHttpServer())
        .get(url('weight-logs/trend'))
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveProperty('current');
          expect(res.body.data).toHaveProperty('weeklyDelta');
          expect(res.body.data).toHaveProperty('dataPoints');
        }));
  });
});
