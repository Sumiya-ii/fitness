import { z } from 'zod';

export const createInvoiceBodySchema = z.object({
  plan: z.enum(['monthly', 'yearly']),
});

export type CreateInvoiceBodyDto = z.infer<typeof createInvoiceBodySchema>;

export const qpayCallbackQuerySchema = z.object({
  sender_invoice_no: z.string().min(1),
});

export type QPayCallbackQueryDto = z.infer<typeof qpayCallbackQuerySchema>;

export interface QPayTokenResponse {
  token_type: string;
  refresh_expires_in: number;
  refresh_token: string;
  access_token: string;
  expires_in: number;
}

export interface QPayBankUrl {
  name: string;
  description: string;
  logo?: string;
  link: string;
}

export interface QPayInvoiceResponse {
  invoice_id: string;
  qr_text: string;
  qr_image: string;
  urls: QPayBankUrl[];
}

export interface QPayPaymentRow {
  payment_id: string;
  payment_status: string;
  payment_date: string;
  payment_fee: string;
  payment_amount: string;
  payment_currency: string;
  payment_wallet: string;
  transaction_type: string;
}

export interface QPayCheckResponse {
  count: number;
  paid_amount: number;
  rows: QPayPaymentRow[];
}

export const PLAN_PRICES_MNT: Record<string, number> = {
  monthly: 19900,
  yearly: 149900,
};
