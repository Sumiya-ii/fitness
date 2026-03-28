import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { NotificationsController } from '../../src/notifications/notifications.controller';
import { NotificationsService } from '../../src/notifications/notifications.service';
import { FakeAuthGuard, createTestApp, url, TEST_USER } from './setup';

describe('Notifications (e2e)', () => {
  let app: INestApplication;

  const mockPrefs = {
    morningReminder: true,
    eveningReminder: true,
    reminderTimezone: 'Asia/Ulaanbaatar',
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    channels: ['push'],
  };

  const mockService = {
    getPreferences: jest.fn().mockResolvedValue(mockPrefs),
    registerDeviceToken: jest.fn().mockResolvedValue(undefined),
    updatePreferences: jest.fn().mockResolvedValue({ ...mockPrefs, morningReminder: false }),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: mockService },
        { provide: APP_GUARD, useClass: FakeAuthGuard },
      ],
    }).compile();
    app = await createTestApp(module);
  });

  afterAll(() => app?.close());
  afterEach(() => jest.clearAllMocks());

  describe('GET /notifications/preferences', () => {
    it('returns preferences', () =>
      request(app.getHttpServer())
        .get(url('notifications/preferences'))
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveProperty('morningReminder');
          expect(res.body.data).toHaveProperty('channels');
        }));
  });

  describe('POST /notifications/device-token', () => {
    it('registers a device token', () =>
      request(app.getHttpServer())
        .post(url('notifications/device-token'))
        .send({ token: 'expo-push-token-abc123', platform: 'ios' })
        .expect(204));

    it('rejects missing token', () =>
      request(app.getHttpServer())
        .post(url('notifications/device-token'))
        .send({ platform: 'ios' })
        .expect(400));

    it('rejects invalid platform', () =>
      request(app.getHttpServer())
        .post(url('notifications/device-token'))
        .send({ token: 'abc', platform: 'windows' })
        .expect(400));

    it('rejects empty token', () =>
      request(app.getHttpServer())
        .post(url('notifications/device-token'))
        .send({ token: '', platform: 'ios' })
        .expect(400));

    it('rejects token longer than 4096 chars', () =>
      request(app.getHttpServer())
        .post(url('notifications/device-token'))
        .send({ token: 'x'.repeat(4097), platform: 'ios' })
        .expect(400));
  });

  describe('PUT /notifications/preferences', () => {
    it('updates preferences', () =>
      request(app.getHttpServer())
        .put(url('notifications/preferences'))
        .send({ morningReminder: false })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.morningReminder).toBe(false);
        }));

    it('validates quiet hours format (HH:MM)', () =>
      request(app.getHttpServer())
        .put(url('notifications/preferences'))
        .send({ quietHoursStart: 'abc' })
        .expect(400));

    it('rejects invalid channel', () =>
      request(app.getHttpServer())
        .put(url('notifications/preferences'))
        .send({ channels: ['sms'] })
        .expect(400));
  });
});
