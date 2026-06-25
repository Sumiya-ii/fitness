import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
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
   * Generic internal webhook for manual subscription adjustments.
   * Requires Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET> — same shared secret
   * used for the RevenueCat webhook to avoid an extra env var.
   */
  @Public()
  @SkipThrottle()
  @Post('webhook')
  async webhook(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    this.verifyWebhookSecret(authorization);
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
   * REVENUECAT_WEBHOOK_SECRET must be set — requests without a valid secret are
   * rejected with 401.
   */
  @Public()
  @SkipThrottle()
  @Post('revenuecat-webhook')
  async revenueCatWebhook(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    this.verifyWebhookSecret(authorization);

    const parsed = revenueCatWebhookSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return this.subscriptionsService.handleRevenueCatWebhook(parsed.data);
  }

  /**
   * Validates the shared webhook secret from the Authorization header.
   * Throws UnauthorizedException if the secret is not configured or the token does not match.
   */
  private verifyWebhookSecret(authorization: string | undefined): void {
    const secret = this.configService.revenueCatWebhookSecret;
    if (!secret) {
      throw new UnauthorizedException('Webhook secret not configured');
    }
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : authorization;
    if (token !== secret) {
      throw new UnauthorizedException('Invalid webhook secret');
    }
  }
}
