import { Controller, Get, Post, Body, BadRequestException } from '@nestjs/common';
import { CurrentUser, AuthenticatedUser, Public } from '../auth';
import { SubscriptionsService } from './subscriptions.service';
import { webhookPayloadSchema } from './subscriptions.dto';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('status')
  async getStatus(@CurrentUser() user: AuthenticatedUser) {
    return {
      data: await this.subscriptionsService.getStatus(user.id),
    };
  }

  @Public()
  @Post('webhook')
  async webhook(@Body() body: unknown) {
    const parsed = webhookPayloadSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return this.subscriptionsService.handleWebhook(parsed.data);
  }
}
