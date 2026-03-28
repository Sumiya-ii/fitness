import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { AnalyticsController } from '../../src/analytics/analytics.controller';
import { AnalyticsService } from '../../src/analytics/analytics.service';
import { FakeAuthGuard, createTestApp, url } from './setup';

describe('Analytics (e2e)', () => {
  let app: INestApplication;

  const mockService = {
    emit: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        { provide: AnalyticsService, useValue: mockService },
        { provide: APP_GUARD, useClass: FakeAuthGuard },
      ],
    }).compile();
    app = await createTestApp(module);
  });

  afterAll(() => app?.close());
  afterEach(() => jest.clearAllMocks());

  describe('POST /analytics/events', () => {
    it('emits an event', () =>
      request(app.getHttpServer())
        .post(url('analytics/events'))
        .send({ event: 'meal_log_saved', properties: { mealType: 'lunch' } })
        .expect(201)
        .expect((res) => {
          expect(res.body.ok).toBe(true);
          expect(mockService.emit).toHaveBeenCalled();
        }));

    it('emits with minimal fields', () =>
      request(app.getHttpServer())
        .post(url('analytics/events'))
        .send({ event: 'onboarding_completed' })
        .expect(201));

    it('rejects missing event name', () =>
      request(app.getHttpServer())
        .post(url('analytics/events'))
        .send({ properties: {} })
        .expect(400));

    it('rejects empty event name', () =>
      request(app.getHttpServer()).post(url('analytics/events')).send({ event: '' }).expect(400));

    it('accepts optional sessionId and platform', () =>
      request(app.getHttpServer())
        .post(url('analytics/events'))
        .send({
          event: 'meal_log_saved',
          sessionId: 'session-abc',
          platform: 'ios',
        })
        .expect(201));
  });
});
