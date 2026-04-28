import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { DashboardController } from '../../src/dashboard/dashboard.controller';
import { DashboardService } from '../../src/dashboard/dashboard.service';
import { FakeAuthGuard, createTestApp, url, TEST_USER } from './setup';

describe('Dashboard (e2e)', () => {
  let app: INestApplication;

  const mockDashboard = {
    consumed: { calories: 1200, protein: 80, carbs: 120, fat: 40 },
    targets: { calories: 2000, protein: 150, carbs: 200, fat: 70 },
    remaining: { calories: 800, protein: 70, carbs: 80, fat: 30 },
    proteinProgress: 0.53,
    meals: [],
    waterConsumed: 1500,
    waterTarget: 2500,
  };

  const mockService = {
    getDailyDashboard: jest.fn().mockResolvedValue(mockDashboard),
    getHistory: jest.fn().mockResolvedValue({ history: [], target: {} }),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        { provide: DashboardService, useValue: mockService },
        { provide: APP_GUARD, useClass: FakeAuthGuard },
      ],
    }).compile();
    app = await createTestApp(module);
  });

  afterAll(() => app?.close());
  afterEach(() => jest.clearAllMocks());

  describe('GET /dashboard', () => {
    it('returns daily dashboard for today', () =>
      request(app.getHttpServer())
        .get(url('dashboard'))
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveProperty('consumed');
          expect(res.body.data).toHaveProperty('targets');
          expect(res.body.data).toHaveProperty('remaining');
          expect(res.body.data).toHaveProperty('waterConsumed');
          expect(mockService.getDailyDashboard).toHaveBeenCalledWith(
            TEST_USER.id,
            undefined,
            undefined,
          );
        }));

    it('accepts a specific date', () =>
      request(app.getHttpServer())
        .get(url('dashboard?date=2025-06-15'))
        .expect(200)
        .expect(() => {
          expect(mockService.getDailyDashboard).toHaveBeenCalledWith(
            TEST_USER.id,
            '2025-06-15',
            undefined,
          );
        }));
  });

  describe('GET /dashboard/history', () => {
    it('returns history with default 7 days', () =>
      request(app.getHttpServer())
        .get(url('dashboard/history'))
        .expect(200)
        .expect(() => {
          expect(mockService.getHistory).toHaveBeenCalledWith(TEST_USER.id, 7, undefined);
        }));

    it('clamps days to min 7', () =>
      request(app.getHttpServer())
        .get(url('dashboard/history?days=3'))
        .expect(200)
        .expect(() => {
          expect(mockService.getHistory).toHaveBeenCalledWith(TEST_USER.id, 7, undefined);
        }));

    it('clamps days to max 90', () =>
      request(app.getHttpServer())
        .get(url('dashboard/history?days=200'))
        .expect(200)
        .expect(() => {
          expect(mockService.getHistory).toHaveBeenCalledWith(TEST_USER.id, 90, undefined);
        }));
  });
});
