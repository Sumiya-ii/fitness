import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { SubscriptionsController } from '../../src/subscriptions/subscriptions.controller';
import { SubscriptionsService } from '../../src/subscriptions/subscriptions.service';
import { ConfigService } from '../../src/config';
import { FakeAuthGuard, createTestApp, url, TEST_USER } from './setup';

describe('Subscriptions (e2e)', () => {
  let app: INestApplication;

  const mockStatus = {
    tier: 'free',
    status: 'active',
    expiresAt: null,
  };

  const mockService = {
    getStatus: jest.fn().mockResolvedValue(mockStatus),
    verifyAndActivate: jest.fn().mockResolvedValue({ tier: 'pro', status: 'active' }),
    handleWebhook: jest.fn().mockResolvedValue({ ok: true }),
    handleRevenueCatWebhook: jest.fn().mockResolvedValue({ ok: true }),
  };

  const mockConfig = {
    revenueCatWebhookSecret: 'test-secret-123',
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [SubscriptionsController],
      providers: [
        { provide: SubscriptionsService, useValue: mockService },
        { provide: ConfigService, useValue: mockConfig },
        { provide: APP_GUARD, useClass: FakeAuthGuard },
      ],
    }).compile();
    app = await createTestApp(module);
  });

  afterAll(() => app?.close());
  afterEach(() => jest.clearAllMocks());

  describe('GET /subscriptions/status', () => {
    it('returns subscription status', () =>
      request(app.getHttpServer())
        .get(url('subscriptions/status'))
        .expect(200)
        .expect((res) => {
          expect(res.body.data.tier).toBe('free');
          expect(res.body.data.status).toBe('active');
        }));
  });

  describe('POST /subscriptions/verify', () => {
    it('verifies and activates subscription', () =>
      request(app.getHttpServer())
        .post(url('subscriptions/verify'))
        .expect(201)
        .expect((res) => {
          expect(res.body.data.tier).toBe('pro');
        }));
  });

  describe('POST /subscriptions/webhook (public)', () => {
    it('handles a valid webhook', () =>
      request(app.getHttpServer())
        .post(url('subscriptions/webhook'))
        .send({
          event: 'started',
          provider: 'qpay',
          userId: TEST_USER.id,
        })
        .expect(201));

    it('rejects invalid event type', () =>
      request(app.getHttpServer())
        .post(url('subscriptions/webhook'))
        .send({ event: 'unknown_event', provider: 'qpay' })
        .expect(400));

    it('rejects invalid provider', () =>
      request(app.getHttpServer())
        .post(url('subscriptions/webhook'))
        .send({ event: 'started', provider: 'stripe' })
        .expect(400));
  });

  describe('POST /subscriptions/revenuecat-webhook (public)', () => {
    const validRcPayload = {
      api_version: '1.0',
      event: {
        type: 'INITIAL_PURCHASE',
        id: 'evt-123',
        app_user_id: TEST_USER.id,
        original_app_user_id: TEST_USER.id,
        environment: 'SANDBOX' as const,
        event_timestamp_ms: Date.now(),
        store: 'APP_STORE' as const,
      },
    };

    it('accepts with valid secret', () =>
      request(app.getHttpServer())
        .post(url('subscriptions/revenuecat-webhook'))
        .set('Authorization', 'Bearer test-secret-123')
        .send(validRcPayload)
        .expect(201));

    it('rejects with wrong secret', () =>
      request(app.getHttpServer())
        .post(url('subscriptions/revenuecat-webhook'))
        .set('Authorization', 'Bearer wrong-secret')
        .send(validRcPayload)
        .expect(401));
  });
});
