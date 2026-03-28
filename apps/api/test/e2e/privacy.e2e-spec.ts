import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { PrivacyController } from '../../src/privacy/privacy.controller';
import { PrivacyService } from '../../src/privacy/privacy.service';
import { FakeAuthGuard, createTestApp, url, TEST_USER } from './setup';

describe('Privacy (e2e)', () => {
  let app: INestApplication;

  const mockConsent = {
    id: 'consent-1',
    consentType: 'health_data',
    version: '1.0',
    accepted: true,
    createdAt: '2025-06-15T00:00:00Z',
  };

  const mockRequest = {
    id: 'req-1',
    requestType: 'data_export',
    status: 'pending',
    createdAt: '2025-06-15T00:00:00Z',
  };

  const mockService = {
    createConsent: jest.fn().mockResolvedValue(mockConsent),
    requestDataExport: jest.fn().mockResolvedValue(mockRequest),
    requestAccountDeletion: jest
      .fn()
      .mockResolvedValue({ ...mockRequest, requestType: 'account_deletion' }),
    getRequests: jest.fn().mockResolvedValue({
      data: [mockRequest],
      meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
    }),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [PrivacyController],
      providers: [
        { provide: PrivacyService, useValue: mockService },
        { provide: APP_GUARD, useClass: FakeAuthGuard },
      ],
    }).compile();
    app = await createTestApp(module);
  });

  afterAll(() => app?.close());
  afterEach(() => jest.clearAllMocks());

  describe('POST /privacy/consent', () => {
    it('records consent', () =>
      request(app.getHttpServer())
        .post(url('privacy/consent'))
        .send({ consentType: 'health_data', version: '1.0', accepted: true })
        .expect(201)
        .expect((res) => {
          expect(res.body.data.consentType).toBe('health_data');
          expect(res.body.data.accepted).toBe(true);
        }));

    it('rejects invalid consentType', () =>
      request(app.getHttpServer())
        .post(url('privacy/consent'))
        .send({ consentType: 'unknown', version: '1.0', accepted: true })
        .expect(400));

    it('rejects missing version', () =>
      request(app.getHttpServer())
        .post(url('privacy/consent'))
        .send({ consentType: 'health_data', accepted: true })
        .expect(400));

    it('rejects version longer than 20 chars', () =>
      request(app.getHttpServer())
        .post(url('privacy/consent'))
        .send({ consentType: 'health_data', version: 'x'.repeat(21), accepted: true })
        .expect(400));

    it('rejects missing accepted flag', () =>
      request(app.getHttpServer())
        .post(url('privacy/consent'))
        .send({ consentType: 'health_data', version: '1.0' })
        .expect(400));

    it('accepts optional ipAddress and userAgent', () =>
      request(app.getHttpServer())
        .post(url('privacy/consent'))
        .send({
          consentType: 'analytics',
          version: '1.0',
          accepted: false,
          ipAddress: '192.168.1.1',
          userAgent: 'Coach/1.0',
        })
        .expect(201));

    it('rejects ipAddress longer than 45 chars', () =>
      request(app.getHttpServer())
        .post(url('privacy/consent'))
        .send({
          consentType: 'health_data',
          version: '1.0',
          accepted: true,
          ipAddress: 'x'.repeat(46),
        })
        .expect(400));
  });

  describe('POST /privacy/export', () => {
    it('creates a data export request', () =>
      request(app.getHttpServer())
        .post(url('privacy/export'))
        .expect(201)
        .expect((res) => {
          expect(res.body.data.status).toBe('pending');
        }));
  });

  describe('POST /privacy/delete-account', () => {
    it('creates an account deletion request', () =>
      request(app.getHttpServer())
        .post(url('privacy/delete-account'))
        .expect(201)
        .expect((res) => {
          expect(res.body.data.requestType).toBe('account_deletion');
        }));
  });

  describe('GET /privacy/requests', () => {
    it('lists privacy requests with pagination', () =>
      request(app.getHttpServer())
        .get(url('privacy/requests'))
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeInstanceOf(Array);
          expect(res.body.meta).toHaveProperty('total');
        }));

    it('accepts page and limit params', () =>
      request(app.getHttpServer()).get(url('privacy/requests?page=2&limit=5')).expect(200));
  });
});
