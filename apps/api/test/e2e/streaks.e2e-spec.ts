import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { StreaksController } from '../../src/streaks/streaks.controller';
import { StreaksService } from '../../src/streaks/streaks.service';
import { FakeAuthGuard, createTestApp, url, TEST_USER } from './setup';

describe('Streaks (e2e)', () => {
  let app: INestApplication;

  const mockStreaks = {
    currentStreak: 5,
    longestStreak: 14,
    totalDaysLogged: 42,
    lastLoggedDate: '2025-06-15',
  };

  const mockService = {
    getStreaks: jest.fn().mockResolvedValue(mockStreaks),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [StreaksController],
      providers: [
        { provide: StreaksService, useValue: mockService },
        { provide: APP_GUARD, useClass: FakeAuthGuard },
      ],
    }).compile();
    app = await createTestApp(module);
  });

  afterAll(() => app?.close());

  describe('GET /streaks', () => {
    it('returns streak data', () =>
      request(app.getHttpServer())
        .get(url('streaks'))
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveProperty('currentStreak');
          expect(res.body.data).toHaveProperty('longestStreak');
          expect(res.body.data).toHaveProperty('totalDaysLogged');
          expect(mockService.getStreaks).toHaveBeenCalledWith(TEST_USER.id);
        }));
  });
});
