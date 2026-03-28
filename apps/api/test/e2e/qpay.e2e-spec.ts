import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { QPayController } from '../../src/qpay/qpay.controller';
import { QPayService } from '../../src/qpay/qpay.service';
import { FakeAuthGuard, createTestApp, url, TEST_USER } from './setup';

describe('QPay (e2e)', () => {
  let app: INestApplication;

  const mockInvoice = {
    invoiceId: 'inv-1',
    qpayInvoiceId: 'qpay-123',
    qrText: 'qr-text-data',
    qrImage: 'data:image/png;base64,...',
    urls: [{ name: 'Khan Bank', link: 'khanbank://pay?...' }],
    amount: 19900,
    plan: 'monthly',
  };

  const mockService = {
    createInvoice: jest.fn().mockResolvedValue(mockInvoice),
    handleCallback: jest.fn().mockResolvedValue({ success: true }),
    checkPaymentStatus: jest.fn().mockResolvedValue({ status: 'pending', paidAt: null }),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [QPayController],
      providers: [
        { provide: QPayService, useValue: mockService },
        { provide: APP_GUARD, useClass: FakeAuthGuard },
      ],
    }).compile();
    app = await createTestApp(module);
  });

  afterAll(() => app?.close());
  afterEach(() => jest.clearAllMocks());

  describe('POST /qpay/invoice', () => {
    it('creates a monthly invoice', () =>
      request(app.getHttpServer())
        .post(url('qpay/invoice'))
        .send({ plan: 'monthly' })
        .expect(201)
        .expect((res) => {
          expect(res.body.data.amount).toBe(19900);
          expect(res.body.data.plan).toBe('monthly');
          expect(res.body.data).toHaveProperty('qrText');
        }));

    it('creates a yearly invoice', () =>
      request(app.getHttpServer()).post(url('qpay/invoice')).send({ plan: 'yearly' }).expect(201));

    it('rejects invalid plan', () =>
      request(app.getHttpServer())
        .post(url('qpay/invoice'))
        .send({ plan: 'lifetime' })
        .expect(400));

    it('rejects missing plan', () =>
      request(app.getHttpServer()).post(url('qpay/invoice')).send({}).expect(400));
  });

  describe('GET /qpay/callback (public)', () => {
    it('handles callback with valid query', () =>
      request(app.getHttpServer())
        .get(url('qpay/callback?sender_invoice_no=inv-1'))
        .expect(200)
        .expect(() => {
          expect(mockService.handleCallback).toHaveBeenCalledWith('inv-1', undefined);
        }));

    it('rejects callback without sender_invoice_no', () =>
      request(app.getHttpServer()).get(url('qpay/callback')).expect(400));

    it('accepts optional token param', () =>
      request(app.getHttpServer())
        .get(url('qpay/callback?sender_invoice_no=inv-1&token=abc'))
        .expect(200)
        .expect(() => {
          expect(mockService.handleCallback).toHaveBeenCalledWith('inv-1', 'abc');
        }));
  });

  describe('GET /qpay/invoice/:invoiceId/status', () => {
    it('checks payment status', () =>
      request(app.getHttpServer())
        .get(url('qpay/invoice/inv-1/status'))
        .expect(200)
        .expect((res) => {
          expect(res.body.data.status).toBe('pending');
          expect(mockService.checkPaymentStatus).toHaveBeenCalledWith('inv-1', TEST_USER.id);
        }));
  });
});
