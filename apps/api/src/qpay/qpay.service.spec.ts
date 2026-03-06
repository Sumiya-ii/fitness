import { UnauthorizedException } from '@nestjs/common';
import { QPayService } from './qpay.service';
import { ConfigService } from '../config/config.service';
import { PrismaService } from '../prisma';

describe('QPayService', () => {
  let service: QPayService;
  let config: ConfigService;
  let prisma: {
    qPayInvoice: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      updateMany: jest.Mock;
    };
    subscription: {
      upsert: jest.Mock;
    };
    subscriptionLedger: {
      create: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const baseInvoice = {
    id: 'invoice-1',
    userId: 'user-1',
    plan: 'monthly',
    amountMnt: 19900,
    qpayInvoiceId: 'qpay-invoice-1',
    senderInvoiceNo: 'coach_12345678_111',
    qrText: 'qr',
    qrImage: 'img',
    urls: [],
    status: 'pending',
    paidAt: null,
    qpayPaymentId: null,
    createdAt: new Date('2026-03-06T00:00:00.000Z'),
    updatedAt: new Date('2026-03-06T00:00:00.000Z'),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-03-06T00:10:00.000Z'));

    config = {
      qpayApiUrl: 'https://merchant-sandbox.qpay.mn/v2',
      qpayClientId: 'client',
      qpayClientSecret: 'secret',
      qpayInvoiceCode: 'invoice-code',
      qpayCallbackToken: 'cb-token',
      qpayInvoiceTtlMinutes: 30,
    } as unknown as ConfigService;

    prisma = {
      qPayInvoice: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
      },
      subscription: {
        upsert: jest.fn().mockResolvedValue({ id: 'sub-1' }),
      },
      subscriptionLedger: {
        create: jest.fn().mockResolvedValue({ id: 'ledger-1' }),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => unknown) =>
        fn({
          qPayInvoice: {
            updateMany: prisma.qPayInvoice.updateMany,
          },
          subscription: {
            upsert: prisma.subscription.upsert,
          },
          subscriptionLedger: {
            create: prisma.subscriptionLedger.create,
          },
        }),
      ),
    };

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token', expires_in: 3600 }),
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          rows: [
            {
              payment_id: 'pay-1',
              payment_status: 'PAID',
              payment_amount: '19900',
              payment_currency: 'MNT',
            },
          ],
        }),
      }) as unknown as typeof fetch;

    service = new QPayService(config, prisma as unknown as PrismaService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('rejects callback when token is invalid', async () => {
    await expect(
      service.handleCallback('coach_12345678_111', 'wrong-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('expires stale pending invoices during status checks', async () => {
    prisma.qPayInvoice.findFirst.mockResolvedValue({
      ...baseInvoice,
      createdAt: new Date('2026-03-05T20:00:00.000Z'),
    });
    prisma.qPayInvoice.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.checkPaymentStatus('invoice-1', 'user-1');

    expect(prisma.qPayInvoice.updateMany).toHaveBeenCalledWith({
      where: { id: 'invoice-1', status: 'pending' },
      data: { status: 'expired' },
    });
    expect(result).toEqual({ status: 'expired', paidAt: null });
  });

  it('activates subscription exactly once when payment is confirmed', async () => {
    prisma.qPayInvoice.findFirst.mockResolvedValue(baseInvoice);
    prisma.qPayInvoice.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.checkPaymentStatus('invoice-1', 'user-1');

    expect(prisma.qPayInvoice.updateMany).toHaveBeenCalledWith({
      where: { id: 'invoice-1', status: 'pending' },
      data: expect.objectContaining({
        status: 'paid',
        qpayPaymentId: 'pay-1',
      }),
    });
    expect(prisma.subscription.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.subscriptionLedger.create).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('paid');
  });

  it('does not activate when paid row amount/currency mismatches', async () => {
    prisma.qPayInvoice.findFirst.mockResolvedValue(baseInvoice);
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rows: [
            {
              payment_id: 'pay-1',
              payment_status: 'PAID',
              payment_amount: '100',
              payment_currency: 'USD',
            },
          ],
        }),
      });

    const result = await service.checkPaymentStatus('invoice-1', 'user-1');

    expect(result).toEqual({ status: 'pending', paidAt: null });
    expect(prisma.subscription.upsert).not.toHaveBeenCalled();
    expect(prisma.subscriptionLedger.create).not.toHaveBeenCalled();
  });
});
