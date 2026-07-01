import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  BadRequestException,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { CurrentUser, AuthenticatedUser, Public } from '../auth';
import { ConfigService } from '../config';
import { TelegramService } from './telegram.service';
import { TelegramBotService } from './telegram-bot.service';
import { confirmLinkSchema } from './telegram.dto';

@Controller('telegram')
export class TelegramController {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly telegramBotService: TelegramBotService,
    private readonly config: ConfigService,
  ) {}

  @Post('link-code')
  async generateLinkCode(@CurrentUser() user: AuthenticatedUser) {
    const code = await this.telegramService.generateLinkCode(user.id);
    return { data: { code } };
  }

  @Post('confirm')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async confirmLink(@Body() body: unknown) {
    const parsed = confirmLinkSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return this.telegramService.confirmLink(
      parsed.data.telegramUserId,
      parsed.data.chatId,
      parsed.data.code,
      parsed.data.username,
    );
  }

  @Get('status')
  async getStatus(@CurrentUser() user: AuthenticatedUser) {
    return { data: await this.telegramService.getLink(user.id) };
  }

  @Post('unlink')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unlink(@CurrentUser() user: AuthenticatedUser) {
    await this.telegramService.unlinkAccount(user.id);
  }

  @Post('webhook')
  @Public()
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Body() body: unknown,
    @Headers('x-telegram-bot-api-secret-token') secretHeader?: string,
  ) {
    // This is a @Public() route, so the secret header is the ONLY thing that
    // authenticates Telegram. TELEGRAM_WEBHOOK_SECRET MUST be set in production
    // (configure it as the secret_token when calling setWebhook). When it is
    // unset we deny rather than skip auth, so a misconfiguration can never leave
    // the webhook open to anonymous callers.
    const expectedSecret = this.config.get('TELEGRAM_WEBHOOK_SECRET');
    if (!expectedSecret) {
      throw new UnauthorizedException('Webhook secret not configured');
    }
    if (!secretHeader || secretHeader !== expectedSecret) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    if (!body || typeof body !== 'object') {
      throw new BadRequestException('Invalid webhook payload');
    }
    await this.telegramBotService.handleUpdate(body as object);
  }
}
