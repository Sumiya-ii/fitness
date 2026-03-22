import { Injectable } from '@nestjs/common';
import { EnvConfig, validateEnv } from '@coach/shared';

@Injectable()
export class ConfigService {
  private readonly config: EnvConfig;

  constructor() {
    this.config = validateEnv();
  }

  get<K extends keyof EnvConfig>(key: K): EnvConfig[K] {
    return this.config[key];
  }

  get isDevelopment(): boolean {
    return this.config.NODE_ENV === 'development';
  }

  get isProduction(): boolean {
    return this.config.NODE_ENV === 'production';
  }

  get isTest(): boolean {
    return this.config.NODE_ENV === 'test';
  }

  get port(): number {
    return this.config.PORT;
  }

  get databaseUrl(): string {
    return this.config.DATABASE_URL;
  }

  get redisUrl(): string {
    return this.config.REDIS_URL;
  }

  get adminUserIds(): string[] {
    return this.config.ADMIN_USER_IDS;
  }

  get bullBoardUser(): string {
    return this.config.BULL_BOARD_USER;
  }

  get bullBoardPassword(): string {
    return this.config.BULL_BOARD_PASSWORD;
  }

  get qpayApiUrl(): string {
    return this.config.QPAY_API_URL ?? 'https://merchant-sandbox.qpay.mn/v2';
  }

  get qpayClientId(): string | undefined {
    return this.config.QPAY_CLIENT_ID;
  }

  get qpayClientSecret(): string | undefined {
    return this.config.QPAY_CLIENT_SECRET;
  }

  get qpayInvoiceCode(): string | undefined {
    return this.config.QPAY_INVOICE_CODE;
  }

  get qpayCallbackToken(): string | undefined {
    return this.config.QPAY_CALLBACK_TOKEN;
  }

  get qpayInvoiceTtlMinutes(): number {
    return this.config.QPAY_INVOICE_TTL_MINUTES ?? 30;
  }
}
