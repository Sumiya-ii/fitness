import {
  Controller,
  Get,
  Post,
  Body,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { CurrentUser, AuthenticatedUser, Public } from '../auth';
import { TelegramService } from './telegram.service';
import { TelegramBotService } from './telegram-bot.service';
import { confirmLinkSchema } from './telegram.dto';

@Controller('telegram')
export class TelegramController {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly telegramBotService: TelegramBotService,
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
  async webhook(@Body() body: unknown) {
    if (!body || typeof body !== 'object') {
      throw new BadRequestException('Invalid webhook payload');
    }
    await this.telegramBotService.handleUpdate(body as object);
  }
}
