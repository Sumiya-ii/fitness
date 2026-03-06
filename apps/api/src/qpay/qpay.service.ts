import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Prisma, QPayInvoice } from '@prisma/client';
import { ConfigService } from '../config/config.service';
import { PrismaService } from '../prisma';
import {
  PLAN_PRICES_MNT,
  type QPayTokenResponse,
  type QPayInvoiceResponse,
  type QPayCheckResponse,
} from './qpay.dto';

@Injectable()
export class QPayService {
  private readonly logger = new Logger(QPayService.name);
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;
  private static readonly EXPECTED_CURRENCY = 'MNT';

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private get apiUrl(): string {
    return this.config.qpayApiUrl;
  }

  private get isConfigured(): boolean {
    return !!(this.config.qpayClientId && this.config.qpayClientSecret && this.config.qpayInvoiceCode);
  }

  private async authenticate(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    if (!this.isConfigured) {
      throw new BadRequestException('QPay is not configured');
    }

    const credentials = Buffer.from(
      `${this.config.qpayClientId}:${this.config.qpayClientSecret}`,
    ).toString('base64');

    const res = await fetch(`${this.apiUrl}/auth/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`QPay auth failed: ${res.status} ${text}`);
      throw new BadRequestException('QPay authentication failed');
    }

    const data = (await res.json()) as QPayTokenResponse;
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000 - 60_000;

    return this.accessToken;
  }

  async createInvoice(
    userId: string,
    plan: string,
    callbackBaseUrl: string,
  ) {
    const amount = PLAN_PRICES_MNT[plan];
    if (!amount) {
      throw new BadRequestException(`Invalid plan: ${plan}`);
    }

    const token = await this.authenticate();
    const senderInvoiceNo = `coach_${userId.slice(0, 8)}_${Date.now()}`;
    const callbackQuery = new URLSearchParams({
      sender_invoice_no: senderInvoiceNo,
    });
    if (this.config.qpayCallbackToken) {
      callbackQuery.set('token', this.config.qpayCallbackToken);
    }

    const res = await fetch(`${this.apiUrl}/invoice`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        invoice_code: this.config.qpayInvoiceCode,
        sender_invoice_no: senderInvoiceNo,
        invoice_receiver_code: userId,
        invoice_description: `Coach Pro - ${plan === 'monthly' ? 'Сарын' : 'Жилийн'} эрх`,
        amount,
        callback_url: `${callbackBaseUrl}/api/v1/qpay/callback?${callbackQuery.toString()}`,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`QPay invoice creation failed: ${res.status} ${text}`);
      throw new BadRequestException('Failed to create QPay invoice');
    }

    const data = (await res.json()) as QPayInvoiceResponse;

    const invoice = await this.prisma.qPayInvoice.create({
      data: {
        userId,
        plan,
        amountMnt: amount,
        qpayInvoiceId: data.invoice_id,
        senderInvoiceNo,
        qrText: data.qr_text,
        qrImage: data.qr_image,
        urls: data.urls as unknown as Prisma.InputJsonValue,
        status: 'pending',
      },
    });

    return {
      invoiceId: invoice.id,
      qpayInvoiceId: data.invoice_id,
      qrText: data.qr_text,
      qrImage: data.qr_image,
      urls: data.urls,
      amount,
      plan,
    };
  }

  async handleCallback(senderInvoiceNo: string, callbackToken?: string) {
    this.validateCallbackToken(callbackToken);

    const invoice = await this.prisma.qPayInvoice.findUnique({
      where: { senderInvoiceNo },
    });

    if (!invoice) {
      this.logger.warn(`Callback for unknown invoice: ${senderInvoiceNo}`);
      return { success: false };
    }

    const status = await this.resolveInvoiceStatus(invoice);
    if (status.status !== 'paid') {
      return { success: false };
    }

    return { success: true };
  }

  async checkPaymentStatus(invoiceId: string, userId: string) {
    const invoice = await this.prisma.qPayInvoice.findFirst({
      where: { id: invoiceId, userId },
    });

    if (!invoice) {
      throw new BadRequestException('Invoice not found');
    }

    return this.resolveInvoiceStatus(invoice);
  }

  private async verifyPayment(
    qpayInvoiceId: string,
    expectedAmountMnt: number,
  ): Promise<{ paymentId: string; amount: number; currency: string } | null> {
    const token = await this.authenticate();

    const res = await fetch(`${this.apiUrl}/payment/check`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        object_type: 'INVOICE',
        object_id: qpayInvoiceId,
        offset: { page_number: 1, page_limit: 100 },
      }),
    });

    if (!res.ok) {
      this.logger.error(`QPay payment check failed: ${res.status}`);
      return null;
    }

    const data = (await res.json()) as QPayCheckResponse;
    const paidRows = data.rows?.filter((r) => r.payment_status === 'PAID') ?? [];
    for (const paidRow of paidRows) {
      const amount = Number.parseFloat(paidRow.payment_amount);
      if (
        Number.isNaN(amount)
        || paidRow.payment_currency !== QPayService.EXPECTED_CURRENCY
        || amount !== expectedAmountMnt
      ) {
        this.logger.warn(
          `Ignoring paid row due to mismatch for invoice ${qpayInvoiceId}: amount=${paidRow.payment_amount} currency=${paidRow.payment_currency}`,
        );
        continue;
      }

      return {
        paymentId: paidRow.payment_id,
        amount,
        currency: paidRow.payment_currency,
      };
    }

    return null;
  }

  private validateCallbackToken(receivedToken?: string): void {
    const expectedToken = this.config.qpayCallbackToken;
    if (!expectedToken) {
      return;
    }
    if (!receivedToken) {
      throw new UnauthorizedException('Invalid callback token');
    }
    const expected = Buffer.from(expectedToken);
    const received = Buffer.from(receivedToken);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
      throw new UnauthorizedException('Invalid callback token');
    }
  }

  private isInvoiceExpired(createdAt: Date): boolean {
    const ttlMs = this.config.qpayInvoiceTtlMinutes * 60_000;
    return Date.now() - createdAt.getTime() > ttlMs;
  }

  private async resolveInvoiceStatus(invoice: QPayInvoice): Promise<{
    status: 'paid' | 'pending' | 'expired' | 'canceled';
    paidAt: Date | null;
  }> {
    if (invoice.status === 'paid') {
      return { status: 'paid', paidAt: invoice.paidAt };
    }

    if (invoice.status === 'expired' || invoice.status === 'canceled') {
      return { status: invoice.status, paidAt: invoice.paidAt };
    }

    if (this.isInvoiceExpired(invoice.createdAt)) {
      await this.prisma.qPayInvoice.updateMany({
        where: { id: invoice.id, status: 'pending' },
        data: { status: 'expired' },
      });
      return { status: 'expired', paidAt: null };
    }

    const paid = await this.verifyPayment(invoice.qpayInvoiceId!, invoice.amountMnt);
    if (!paid) {
      return { status: 'pending', paidAt: null };
    }

    return this.finalizePaidInvoice(invoice, paid.paymentId);
  }

  private async finalizePaidInvoice(
    invoice: QPayInvoice,
    paymentId: string,
  ): Promise<{
    status: 'paid' | 'pending' | 'expired' | 'canceled';
    paidAt: Date | null;
  }> {
    const paidAt = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.qPayInvoice.updateMany({
        where: { id: invoice.id, status: 'pending' },
        data: {
          status: 'paid',
          paidAt,
          qpayPaymentId: paymentId,
        },
      });

      if (result.count !== 1) {
        return false;
      }

      await this.activateSubscription(tx, invoice.userId, invoice.plan);
      return true;
    });

    if (updated) {
      return { status: 'paid', paidAt };
    }

    const latest = await this.prisma.qPayInvoice.findUnique({
      where: { id: invoice.id },
    });

    if (latest?.status === 'paid') {
      return { status: 'paid', paidAt: latest.paidAt };
    }

    if (latest?.status === 'expired' || latest?.status === 'canceled') {
      return { status: latest.status, paidAt: latest.paidAt };
    }

    return { status: 'pending', paidAt: null };
  }

  private async activateSubscription(
    tx: Prisma.TransactionClient,
    userId: string,
    plan: string,
  ) {
    const now = new Date();
    const periodEnd = new Date(now);
    if (plan === 'monthly') {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    const subscription = await tx.subscription.upsert({
      where: { userId },
      update: {
        tier: 'pro',
        status: 'active',
        provider: 'qpay',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
      create: {
        userId,
        tier: 'pro',
        status: 'active',
        provider: 'qpay',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    });

    await tx.subscriptionLedger.create({
      data: {
        subscriptionId: subscription.id,
        event: 'started',
        provider: 'qpay',
        metadata: { plan },
      },
    });
  }
}
