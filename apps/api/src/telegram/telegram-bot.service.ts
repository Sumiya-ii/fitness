import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { ConfigService } from '../config';
import { TelegramService } from './telegram.service';
import { IdempotencyService } from './idempotency.service';
import { ChatService } from '../chat/chat.service';
import { TelegramFoodParserService } from './telegram-food-parser.service';
import { MealLogsService } from '../meal-logs/meal-logs.service';
import { SubscriptionsService } from '../subscriptions';
import { Telegraf, Context } from 'telegraf';
import type { Message } from 'telegraf/types';

const IDEMPOTENCY_TTL_MINUTES = 24 * 60;

// Mongolia is UTC+8
const MONGOLIA_UTC_OFFSET_HOURS = 8;

// MealLog.items.snapshotFoodName is VarChar(500); quickAdd copies the note into
// it, so the note string must stay within this bound or the insert crashes.
const MAX_NOTE_LENGTH = 500;

// Bilingual upgrade prompt shown to non-Pro users for AI coach chat / voice.
const PRO_REQUIRED_MESSAGE =
  '⭐ AI дасгалжуулагчтай чатлах, дуугаар бүртгэхэд Coach Pro шаардлагатай.\n' +
  'Coach аппаа нээж Pro захиалга идэвхжүүлнэ үү.\n\n' +
  '⭐ Coach Pro is required to chat with the AI coach and log by voice.\n' +
  'Open the Coach app to upgrade.';

function truncateNote(note: string): string {
  return note.length > MAX_NOTE_LENGTH ? note.slice(0, MAX_NOTE_LENGTH) : note;
}

function inferMealTypeFromTime(): 'breakfast' | 'lunch' | 'dinner' | 'snack' | null {
  const now = new Date();
  const mongoliaHour = (now.getUTCHours() + MONGOLIA_UTC_OFFSET_HOURS) % 24;
  if (mongoliaHour >= 5 && mongoliaHour < 11) return 'breakfast';
  if (mongoliaHour >= 11 && mongoliaHour < 15) return 'lunch';
  if (mongoliaHour >= 15 && mongoliaHour < 18) return 'snack';
  if (mongoliaHour >= 18 && mongoliaHour < 23) return 'dinner';
  return null;
}

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotService.name);
  private bot: Telegraf | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly telegramService: TelegramService,
    private readonly idempotencyService: IdempotencyService,
    private readonly chatService: ChatService,
    private readonly foodParserService: TelegramFoodParserService,
    private readonly mealLogsService: MealLogsService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  /** True when the app user has an active Pro entitlement. */
  private async isPro(userId: string): Promise<boolean> {
    return (await this.subscriptionsService.checkEntitlement(userId)) === 'pro';
  }

  onModuleInit() {
    const token = this.config.get('TELEGRAM_BOT_TOKEN');
    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not set — bot disabled');
      return;
    }

    this.bot = new Telegraf(token);

    // Deep-link entry: t.me/BOT?start=CODE — auto-links account
    this.bot.start(async (ctx) => {
      const payload = (ctx as Context & { startPayload?: string }).startPayload?.trim();
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
    this.bot.on('voice', (ctx) => this.handleVoiceMessage(ctx));

    // Inline keyboard callbacks for meal log confirmation. The draft id is
    // embedded in callback_data (log_confirm:<id>) so a confirm maps to exactly
    // one draft. Legacy 'log_confirm' (no id) is still accepted for safety.
    this.bot.action(/^log_confirm(?::(.+))?$/, (ctx) => this.handleLogConfirm(ctx, ctx.match[1]));
    this.bot.action('log_cancel', (ctx) => this.handleLogCancel(ctx));

    this.bot.catch((err) => {
      this.logger.error('Telegram bot error', err instanceof Error ? err.message : String(err));
      Sentry.captureException(err, { tags: { service: 'telegram_bot', stage: 'bot_catch' } });
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
      Sentry.captureException(err, { tags: { service: 'telegram_bot', stage: 'start_with_code' } });
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
      Sentry.captureException(err, { tags: { service: 'telegram_bot', stage: 'link_command' } });
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
      const parsed = await this.foodParserService.parse(text);

      if (parsed.isFoodLog && parsed.items.length > 0) {
        // Food logging via text stays free for linked users. Store draft for
        // confirmation, tagged with a draft id echoed in the confirm callback.
        const draftId = this.foodParserService.newDraftId();
        await this.foodParserService.saveDraft(telegramUserId, {
          ...parsed,
          originalText: text,
          draftId,
        });

        // Build confirmation message
        const itemLines = parsed.items
          .map((i) => `• ${i.quantity > 1 ? `${i.quantity} ` : ''}${i.name} — ${i.calories} ккал`)
          .join('\n');
        const replyText =
          `🍽️ Дараах хоолыг бүртгэх үү?\n\n${itemLines}\n\n` +
          `Нийт: ${parsed.totalCalories} ккал | 🥩 ${parsed.totalProtein}г | 🍞 ${parsed.totalCarbs}г | 🧈 ${parsed.totalFat}г`;

        await ctx.reply(replyText, {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Тийм, бүртгэх', callback_data: `log_confirm:${draftId}` },
                { text: '❌ Болих', callback_data: 'log_cancel' },
              ],
            ],
          },
        });

        await this.idempotencyService.store(
          idempotencyKey,
          { status: 200, body: replyText },
          IDEMPOTENCY_TTL_MINUTES,
        );
      } else {
        // AI coaching reply — gated behind Pro (mirrors PhotosController's
        // SubscriptionGuard). Non-Pro users get a bilingual upgrade prompt.
        if (!(await this.isPro(userId))) {
          await this.idempotencyService.store(
            idempotencyKey,
            { status: 200, body: PRO_REQUIRED_MESSAGE },
            IDEMPOTENCY_TTL_MINUTES,
          );
          await ctx.reply(PRO_REQUIRED_MESSAGE);
          return;
        }

        const result = await this.chatService.sendMessage(userId, text);

        await this.idempotencyService.store(
          idempotencyKey,
          { status: 200, body: result.message },
          IDEMPOTENCY_TTL_MINUTES,
        );

        await ctx.reply(result.message);
      }
    } catch (err) {
      this.logger.error(
        'Failed to process message',
        err instanceof Error ? err.message : String(err),
      );
      Sentry.captureException(err, { tags: { service: 'telegram_bot', stage: 'text_message' } });
      await ctx.reply('Sorry, I had trouble responding. Please try again.');
    }
  }

  private async handleVoiceMessage(ctx: Context) {
    const msg = ctx.message as Message.VoiceMessage | undefined;
    if (!msg?.voice) return;

    const telegramUserId = ctx.from?.id;
    if (!telegramUserId) return;

    // Idempotency — use Telegram's stable file_unique_id
    const idempotencyKey = `tg:voice:${msg.voice.file_unique_id}`;
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

    // Voice logging (transcription + parsing/coaching) is a Pro feature. Gate
    // before spending any Whisper credits; non-Pro users get an upgrade prompt.
    if (!(await this.isPro(userId))) {
      await this.idempotencyService.store(
        idempotencyKey,
        { status: 200, body: PRO_REQUIRED_MESSAGE },
        IDEMPOTENCY_TTL_MINUTES,
      );
      await ctx.reply(PRO_REQUIRED_MESSAGE);
      return;
    }

    // Immediate feedback — user knows processing started
    const processingMsg = await ctx.reply('🎙️ Сонсож байна...');

    try {
      // Download audio from Telegram
      const token = this.config.get('TELEGRAM_BOT_TOKEN')!;
      const file = await ctx.telegram.getFile(msg.voice.file_id);
      if (!file.file_path) throw new Error('Telegram file_path missing');

      const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error(`Audio download failed: ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = Buffer.from(arrayBuffer);

      // Transcribe with Whisper
      const transcription = await this.foodParserService.transcribeVoice(audioBuffer);

      if (!transcription) {
        const errMsg = 'Дуу тодорхойгүй байна. Дахин илгээнэ үү.';
        await ctx.telegram.editMessageText(
          ctx.chat!.id,
          processingMsg.message_id,
          undefined,
          errMsg,
        );
        await this.idempotencyService.store(
          idempotencyKey,
          { status: 200, body: errMsg },
          IDEMPOTENCY_TTL_MINUTES,
        );
        return;
      }

      // Parse intent from transcription
      const parsed = await this.foodParserService.parse(transcription);

      if (parsed.isFoodLog && parsed.items.length > 0) {
        const draftId = this.foodParserService.newDraftId();
        await this.foodParserService.saveDraft(telegramUserId, {
          ...parsed,
          originalText: transcription,
          draftId,
        });

        const itemLines = parsed.items
          .map((i) => `• ${i.quantity > 1 ? `${i.quantity} ` : ''}${i.name} — ${i.calories} ккал`)
          .join('\n');
        const replyText =
          `🎙️ "${transcription}"\n\n` +
          `🍽️ Дараах хоолыг бүртгэх үү?\n\n${itemLines}\n\n` +
          `Нийт: ${parsed.totalCalories} ккал | 🥩 ${parsed.totalProtein}г | 🍞 ${parsed.totalCarbs}г | 🧈 ${parsed.totalFat}г`;

        await ctx.telegram.editMessageText(
          ctx.chat!.id,
          processingMsg.message_id,
          undefined,
          replyText,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '✅ Тийм, бүртгэх', callback_data: `log_confirm:${draftId}` },
                  { text: '❌ Болих', callback_data: 'log_cancel' },
                ],
              ],
            },
          },
        );

        await this.idempotencyService.store(
          idempotencyKey,
          { status: 200, body: replyText },
          IDEMPOTENCY_TTL_MINUTES,
        );
      } else {
        // Coaching question via voice — route through ChatService
        const result = await this.chatService.sendMessage(userId, transcription);
        const replyText = `🎙️ "${transcription}"\n\n${result.message}`;

        await ctx.telegram.editMessageText(
          ctx.chat!.id,
          processingMsg.message_id,
          undefined,
          replyText,
        );

        await this.idempotencyService.store(
          idempotencyKey,
          { status: 200, body: replyText },
          IDEMPOTENCY_TTL_MINUTES,
        );
      }
    } catch (err) {
      this.logger.error(
        'Failed to process voice message',
        err instanceof Error ? err.message : String(err),
      );
      Sentry.captureException(err, { tags: { service: 'telegram_bot', stage: 'voice_message' } });
      await ctx.telegram.editMessageText(
        ctx.chat!.id,
        processingMsg.message_id,
        undefined,
        'Алдаа гарлаа. Дахин оролдоно уу.',
      );
    }
  }

  private async handleLogConfirm(ctx: Context, callbackDraftId?: string) {
    const telegramUserId = ctx.from?.id;
    if (!telegramUserId) {
      await ctx.answerCbQuery();
      return;
    }

    // Atomic get-and-delete: the draft is consumed exactly once, so double-
    // tapping the confirm button can't log the meal twice. A second tap finds
    // no draft and is treated as a no-op.
    const draft = await this.foodParserService.takeDraft(telegramUserId);
    if (!draft) {
      await ctx.answerCbQuery();
      await ctx.editMessageText('⏱️ Хугацаа дуусчээ. Хоолоо дахин бичнэ үү.');
      return;
    }

    // Validate the button maps to the draft we just consumed. A mismatch means
    // an old (superseded) button was tapped — put the current draft back so the
    // live confirmation still works, and ignore the stale tap.
    if (callbackDraftId && draft.draftId && callbackDraftId !== draft.draftId) {
      await this.foodParserService.saveDraft(telegramUserId, draft);
      await ctx.answerCbQuery();
      return;
    }

    const userId = await this.telegramService.findUserByTelegram(String(telegramUserId));
    if (!userId) {
      await ctx.answerCbQuery();
      return;
    }

    try {
      const mealType = draft.mealType ?? inferMealTypeFromTime();
      const note = truncateNote(
        draft.items.map((i) => `${i.quantity > 1 ? `${i.quantity}x ` : ''}${i.name}`).join(', '),
      );

      await this.mealLogsService.quickAdd(userId, {
        calories: draft.totalCalories,
        proteinGrams: draft.totalProtein,
        carbsGrams: draft.totalCarbs,
        fatGrams: draft.totalFat,
        source: 'telegram',
        mealType: mealType ?? undefined,
        note,
      });

      await ctx.answerCbQuery('Бүртгэгдлээ!');
      await ctx.editMessageText(
        `✅ Бүртгэгдлээ!\n\n${note}\n\n${draft.totalCalories} ккал нэмэгдлээ.`,
      );
    } catch (err) {
      this.logger.error(
        'Failed to create meal log from Telegram',
        err instanceof Error ? err.message : String(err),
      );
      Sentry.captureException(err, { tags: { service: 'telegram_bot', stage: 'log_confirm' } });
      await ctx.answerCbQuery();
      await ctx.editMessageText('Алдаа гарлаа. Дахин оролдоно уу.');
    }
  }

  private async handleLogCancel(ctx: Context) {
    const telegramUserId = ctx.from?.id;
    if (telegramUserId) {
      await this.foodParserService.deleteDraft(telegramUserId);
    }
    await ctx.answerCbQuery();
    await ctx.editMessageText('Болиулагдлаа.');
  }
}
