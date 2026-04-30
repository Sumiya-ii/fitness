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
import { SkipThrottle } from '@nestjs/throttler';
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
    return { code };
  }

  @Post('confirm')
  @Public()
  @HttpCode(HttpStatus.OK)
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
    return this.telegramService.getLink(user.id);
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
    // If TELEGRAM_WEBHOOK_SECRET is configured, require the header to match.
    // When unset the check is skipped for backward compatibility.
    const expectedSecret = this.config.get('TELEGRAM_WEBHOOK_SECRET');
    if (expectedSecret) {
      if (!secretHeader || secretHeader !== expectedSecret) {
        throw new UnauthorizedException('Invalid webhook secret');
      }
    }

    if (!body || typeof body !== 'object') {
      throw new BadRequestException('Invalid webhook payload');
    }
    await this.telegramBotService.handleUpdate(body as object);
  }
}
