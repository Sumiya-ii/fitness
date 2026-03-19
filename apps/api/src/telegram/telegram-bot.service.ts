import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '../config';
import { TelegramService } from './telegram.service';
import { IdempotencyService } from './idempotency.service';
import { ChatService } from '../chat/chat.service';
import { Telegraf } from 'telegraf';
import type { NarrowedContext, Context, Types } from 'telegraf';

const IDEMPOTENCY_TTL_MINUTES = 24 * 60;

type StartContext = NarrowedContext<Context, Types.Update.MessageUpdate>;

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotService.name);
  private bot: Telegraf | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly telegramService: TelegramService,
    private readonly idempotencyService: IdempotencyService,
    private readonly chatService: ChatService,
  ) {}

  onModuleInit() {
    const token = this.config.get('TELEGRAM_BOT_TOKEN');
    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not set — bot disabled');
      return;
    }

    this.bot = new Telegraf(token);

    // Deep-link entry: t.me/BOT?start=CODE — auto-links account
    this.bot.start(async (ctx: StartContext) => {
      const payload = (ctx as StartContext & { startPayload?: string }).startPayload?.trim();
      if (payload && /^\d{6}$/.test(payload)) {
        await this.handleStartWithCode(ctx, payload);
      } else {
        await ctx.reply(
          'Welcome to Coach! 👋\n\nOpen the Coach app → Settings → Telegram to link your account.',
        );
      }
    });

    this.bot.command('link', (ctx) => this.handleLinkCommand(ctx));
    this.bot.on('text', (ctx) => this.handleTextMessage(ctx));

    this.bot.catch((err) => {
      this.logger.error('Telegram bot error', err instanceof Error ? err.message : String(err));
    });
  }

  onModuleDestroy() {
    if (this.bot) {
      this.bot.stop('SIGTERM');
      this.bot = null;
    }
  }

  async handleUpdate(update: object): Promise<void> {
    if (!this.bot) {
      throw new Error('Telegram bot not configured (TELEGRAM_BOT_TOKEN missing)');
    }
    await this.bot.handleUpdate(update as never);
  }

  private async handleStartWithCode(ctx: Context, code: string) {
    const from = ctx.from;
    const chat = ctx.chat;
    if (!from || !chat) return;

    try {
      await this.telegramService.confirmLink(String(from.id), String(chat.id), code, from.username);
      await ctx.reply(
        '✅ Account linked!\n\nYou can now chat with your AI nutrition coach right here. Ask me anything — calories, meal ideas, your daily progress.',
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to link account';
      await ctx.reply(
        `❌ ${msg}\n\nThe code may have expired. Go back to the Coach app and tap "Connect with Telegram" again.`,
      );
    }
  }

  private async handleLinkCommand(ctx: Context) {
    const text = (ctx.message as { text?: string })?.text ?? '';
    const code = text.replace(/^\/link\s*/i, '').trim();
    if (!code) {
      await ctx.reply('Send /link followed by your 6-digit code.\nExample: /link 123456');
      return;
    }

    const from = ctx.from;
    const chat = ctx.chat;
    if (!from || !chat) return;

    try {
      await this.telegramService.confirmLink(String(from.id), String(chat.id), code, from.username);
      await ctx.reply('✅ Account linked! You can now chat with your AI nutrition coach.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to link account';
      await ctx.reply(`❌ ${msg}`);
    }
  }

  private async handleTextMessage(ctx: Context) {
    const msg = ctx.message;
    if (!msg || !('text' in msg)) return;

    const telegramUserId = ctx.from?.id;
    if (!telegramUserId) return;

    // Deduplicate — Telegram retries on timeout
    const idempotencyKey = `tg:msg:${msg.message_id}`;
    const cached = await this.idempotencyService.check(idempotencyKey);
    if (cached.exists && cached.response) {
      await ctx.reply(cached.response.body as string);
      return;
    }

    const userId = await this.telegramService.findUserByTelegram(String(telegramUserId));
    if (!userId) {
      await ctx.reply(
        'Your account is not linked yet.\n\nOpen the Coach app → Settings → Telegram to connect.',
      );
      return;
    }

    const text = msg.text.trim();
    if (!text) return;

    try {
      // Route every message through GPT — response is stored in shared chat history
      const result = await this.chatService.sendMessage(userId, text);

      await this.idempotencyService.store(
        idempotencyKey,
        { status: 200, body: result.message },
        IDEMPOTENCY_TTL_MINUTES,
      );

      await ctx.reply(result.message);
    } catch (err) {
      this.logger.error(
        'Failed to get AI response',
        err instanceof Error ? err.message : String(err),
      );
      await ctx.reply('Sorry, I had trouble responding. Please try again.');
    }
  }
}
