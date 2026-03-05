import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { CurrentUser, AuthenticatedUser, Public } from '../auth';
import { QPayService } from './qpay.service';
import { createInvoiceBodySchema, qpayCallbackQuerySchema } from './qpay.dto';

@Controller('qpay')
export class QPayController {
  constructor(private readonly qpayService: QPayService) {}

  @Post('invoice')
  async createInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const parsed = createInvoiceBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }

    const protocol = req.headers['x-forwarded-proto'] ?? req.protocol;
    const host = req.headers['x-forwarded-host'] ?? req.get('host');
    const callbackBaseUrl = `${protocol}://${host}`;

    const result = await this.qpayService.createInvoice(
      user.id,
      parsed.data.plan,
      callbackBaseUrl,
    );

    return { data: result };
  }

  @Public()
  @Get('callback')
  async callback(@Query() query: unknown) {
    const parsed = qpayCallbackQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }

    return this.qpayService.handleCallback(parsed.data.sender_invoice_no);
  }

  @Get('invoice/:invoiceId/status')
  async checkStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('invoiceId') invoiceId: string,
  ) {
    const result = await this.qpayService.checkPaymentStatus(
      invoiceId,
      user.id,
    );
    return { data: result };
  }
}
