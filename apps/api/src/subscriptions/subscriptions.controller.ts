import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { CurrentUser, AuthenticatedUser, Public } from '../auth';
import { ConfigService } from '../config';
import { SubscriptionsService } from './subscriptions.service';
import { webhookPayloadSchema, revenueCatWebhookSchema } from './subscriptions.dto';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly configService: ConfigService,
  ) {}

  @Get('status')
  async getStatus(@CurrentUser() user: AuthenticatedUser) {
    return {
      data: await this.subscriptionsService.getStatus(user.id),
    };
  }

  /**
   * Client-initiated entitlement verification.
   * Calls RevenueCat REST API to check if the user has 'pro' entitlement,
   * and activates the subscription in our DB immediately if so.
   * This closes the race window between IAP purchase and webhook arrival.
   */
  @Post('verify')
  async verify(@CurrentUser() user: AuthenticatedUser) {
    return {
      data: await this.subscriptionsService.verifyAndActivate(user.id),
    };
  }

  /**
   * Generic (internal / QPay) webhook — kept for backwards compatibility.
   */
  @Public()
  @Post('webhook')
  async webhook(@Body() body: unknown) {
    const parsed = webhookPayloadSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return this.subscriptionsService.handleWebhook(parsed.data);
  }

  /**
   * RevenueCat server-to-server webhook.
   * Protected with a shared Bearer secret configured in the RevenueCat dashboard
   * (Dashboard → Project → Integrations → Webhooks → Authorization header).
   * Set REVENUECAT_WEBHOOK_SECRET in .env to enable verification.
   */
  @Public()
  @Post('revenuecat-webhook')
  async revenueCatWebhook(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const secret = this.configService.revenueCatWebhookSecret;
    if (secret) {
      const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : authorization;
      if (token !== secret) {
        throw new UnauthorizedException('Invalid webhook secret');
      }
    }

    const parsed = revenueCatWebhookSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return this.subscriptionsService.handleRevenueCatWebhook(parsed.data);
  }
}
