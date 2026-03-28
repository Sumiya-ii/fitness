import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { WeeklySummaryController } from '../../src/weekly-summary/weekly-summary.controller';
import { WeeklySummaryService } from '../../src/weekly-summary/weekly-summary.service';
import { FakeAuthGuard, createTestApp, url, TEST_USER } from './setup';

describe('Weekly Summary (e2e)', () => {
  let app: INestApplication;

  const mockSummary = {
    weekStart: '2025-06-09',
    weekEnd: '2025-06-15',
    daysLogged: 5,
    averageCalories: 1850,
    averageProtein: 120,
    averageCarbs: 200,
    averageFat: 65,
    adherenceScore: 0.85,
    weightStart: 73.0,
    weightEnd: 72.5,
    weightDelta: -0.5,
  };

  const mockService = {
    getWeeklySummary: jest.fn().mockResolvedValue(mockSummary),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [WeeklySummaryController],
      providers: [
        { provide: WeeklySummaryService, useValue: mockService },
        { provide: APP_GUARD, useClass: FakeAuthGuard },
      ],
    }).compile();
    app = await createTestApp(module);
  });

  afterAll(() => app?.close());
  afterEach(() => jest.clearAllMocks());

  describe('GET /weekly-summary', () => {
    it('returns weekly summary for current week', () =>
      request(app.getHttpServer())
        .get(url('weekly-summary'))
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveProperty('daysLogged');
          expect(res.body.data).toHaveProperty('averageCalories');
          expect(res.body.data).toHaveProperty('adherenceScore');
          expect(res.body.data).toHaveProperty('weightDelta');
          expect(mockService.getWeeklySummary).toHaveBeenCalledWith(TEST_USER.id, undefined);
        }));

    it('accepts week param', () =>
      request(app.getHttpServer())
        .get(url('weekly-summary?week=2025-W24'))
        .expect(200)
        .expect(() => {
          expect(mockService.getWeeklySummary).toHaveBeenCalledWith(TEST_USER.id, '2025-W24');
        }));
  });
});
