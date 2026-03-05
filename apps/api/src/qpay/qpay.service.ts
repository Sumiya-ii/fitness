import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { PrismaService } from '../prisma';
import { SubscriptionsService } from '../subscriptions';
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
  private refreshToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly subscriptionsService: SubscriptionsService,
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
    this.refreshToken = data.refresh_token;
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
        callback_url: `${callbackBaseUrl}/api/v1/qpay/callback?sender_invoice_no=${senderInvoiceNo}`,
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
        urls: data.urls as any,
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

  async handleCallback(senderInvoiceNo: string) {
    const invoice = await this.prisma.qPayInvoice.findUnique({
      where: { senderInvoiceNo },
    });

    if (!invoice) {
      this.logger.warn(`Callback for unknown invoice: ${senderInvoiceNo}`);
      return { success: false };
    }

    if (invoice.status === 'paid') {
      return { success: true };
    }

    const paid = await this.verifyPayment(invoice.qpayInvoiceId!);
    if (!paid) {
      return { success: false };
    }

    await this.prisma.qPayInvoice.update({
      where: { id: invoice.id },
      data: {
        status: 'paid',
        paidAt: new Date(),
        qpayPaymentId: paid.paymentId,
      },
    });

    await this.activateSubscription(invoice.userId, invoice.plan);

    return { success: true };
  }

  async checkPaymentStatus(invoiceId: string, userId: string) {
    const invoice = await this.prisma.qPayInvoice.findFirst({
      where: { id: invoiceId, userId },
    });

    if (!invoice) {
      throw new BadRequestException('Invoice not found');
    }

    if (invoice.status === 'paid') {
      return { status: 'paid' as const, paidAt: invoice.paidAt };
    }

    const paid = await this.verifyPayment(invoice.qpayInvoiceId!);
    if (paid) {
      await this.prisma.qPayInvoice.update({
        where: { id: invoice.id },
        data: {
          status: 'paid',
          paidAt: new Date(),
          qpayPaymentId: paid.paymentId,
        },
      });

      await this.activateSubscription(invoice.userId, invoice.plan);
      return { status: 'paid' as const, paidAt: new Date() };
    }

    return { status: 'pending' as const, paidAt: null };
  }

  private async verifyPayment(
    qpayInvoiceId: string,
  ): Promise<{ paymentId: string; amount: number } | null> {
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
    const paidRow = data.rows?.find((r) => r.payment_status === 'PAID');
    if (paidRow) {
      return {
        paymentId: paidRow.payment_id,
        amount: parseFloat(paidRow.payment_amount),
      };
    }

    return null;
  }

  private async activateSubscription(userId: string, plan: string) {
    const now = new Date();
    const periodEnd = new Date(now);
    if (plan === 'monthly') {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    const existing = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (existing) {
      await this.prisma.subscription.update({
        where: { userId },
        data: {
          tier: 'pro',
          status: 'active',
          provider: 'qpay',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });
    } else {
      await this.prisma.subscription.create({
        data: {
          userId,
          tier: 'pro',
          status: 'active',
          provider: 'qpay',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });
    }

    await this.prisma.subscriptionLedger.create({
      data: {
        subscriptionId: (
          await this.prisma.subscription.findUnique({ where: { userId } })
        )!.id,
        event: 'started',
        provider: 'qpay',
        metadata: { plan },
      },
    });
  }
}
