import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '../config';
import { TelegramService } from './telegram.service';
import { MealLogsService } from '../meal-logs/meal-logs.service';
import { IdempotencyService } from './idempotency.service';
import { Telegraf, Context } from 'telegraf';

const IDEMPOTENCY_TTL_MINUTES = 24 * 60; // 24 hours

/**
 * Simple text parser: extract first number as calories, rest as note.
 * e.g. "rice 200" -> calories=200, note="rice 200"
 * e.g. "200 cal chicken" -> calories=200, note="200 cal chicken"
 */
function parseFoodText(text: string): { calories: number; note: string } {
  const trimmed = text.trim();
  const match = trimmed.match(/(\d+)\s*(?:cal|kcal)?/i);
  const calories = match ? parseInt(match[1], 10) : 0;
  return { calories, note: trimmed || 'Quick Add' };
}

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private bot: Telegraf | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly telegramService: TelegramService,
    private readonly mealLogsService: MealLogsService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  onModuleInit() {
    const token = this.config.get('TELEGRAM_BOT_TOKEN');
    if (!token) return;

    this.bot = new Telegraf(token);

    this.bot.command('link', (ctx) => this.handleLinkCommand(ctx));
    this.bot.on('text', (ctx) => this.handleTextMessage(ctx));

    this.bot.catch((err) => {
      console.error('Telegram bot error:', err);
    });
  }

  onModuleDestroy() {
    if (this.bot) {
      this.bot.stop('SIGTERM');
      this.bot = null;
    }
  }

  /**
   * Handle webhook update payload (called from controller).
   */
  async handleUpdate(update: object): Promise<void> {
    if (!this.bot) {
      throw new Error('Telegram bot not configured (TELEGRAM_BOT_TOKEN missing)');
    }
    await this.bot.handleUpdate(update as never);
  }

  private async handleLinkCommand(ctx: Context) {
    const text = (ctx.message as { text?: string })?.text ?? '';
    const code = text.replace(/^\/link\s*/i, '').trim();
    if (!code) {
      await ctx.reply(
        'Send /link followed by your 6-digit code from the Coach app. Example: /link 123456',
      );
      return;
    }

    const from = ctx.from;
    const chat = ctx.chat;
    if (!from || !chat) return;

    const telegramUserId = String(from.id);
    const chatId = String(chat.id);
    const username = from.username ?? undefined;

    try {
      await this.telegramService.confirmLink(
        telegramUserId,
        chatId,
        code,
        username,
      );
      await ctx.reply(`✅ Account linked successfully! Welcome, Coach user.`);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to link account';
      await ctx.reply(`❌ ${msg}`);
    }
  }

  private async handleTextMessage(ctx: Context) {
    const msg = ctx.message;
    if (!msg || !('text' in msg)) return;

    const messageId = msg.message_id;
    const telegramUserId = ctx.from?.id;
    if (!telegramUserId) return;

    const idempotencyKey = `msg:${messageId}`;
    const cached = await this.idempotencyService.check(idempotencyKey);
    if (cached.exists && cached.response) {
      await ctx.reply(cached.response.body as string);
      return;
    }

    const userId = await this.telegramService.findUserByTelegram(
      String(telegramUserId),
    );
    if (!userId) {
      await ctx.reply(
        'Please link your Telegram account first. In the Coach app, go to Settings → Telegram and follow the instructions.',
      );
      return;
    }

    const text = msg.text.trim();
    if (!text) return;

    try {
      const { calories, note } = parseFoodText(text);
      await this.mealLogsService.quickAdd(userId, {
        calories,
        proteinGrams: 0,
        carbsGrams: 0,
        fatGrams: 0,
        note,
        source: 'telegram',
      });

      const response = `✅ Logged: ${note} (${calories} cal)`;
      await this.idempotencyService.store(
        idempotencyKey,
        { status: 200, body: response },
        IDEMPOTENCY_TTL_MINUTES,
      );
      await ctx.reply(response);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to log meal';
      await ctx.reply(`❌ ${msg}`);
    }
  }
}
