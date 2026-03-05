import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '../config';
import { TelegramService } from './telegram.service';
import { MealLogsService } from '../meal-logs/meal-logs.service';
import { FoodsService } from '../foods/foods.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { IdempotencyService } from './idempotency.service';
import { Telegraf, Context } from 'telegraf';

const IDEMPOTENCY_TTL_MINUTES = 24 * 60;

interface ParsedItem {
  name: string;
  quantityGrams: number;
  foodId?: string;
  servingId?: string;
  servingQuantity?: number;
}

const QUANTITY_PATTERNS = [
  /(\d+(?:[.,]\d+)?)\s*(?:гр|г|gr|g)\b/i,
  /(\d+(?:[.,]\d+)?)\s*(?:кг|kg)\b/i,
  /(\d+(?:[.,]\d+)?)\s*(?:мл|ml)\b/i,
  /(\d+(?:[.,]\d+)?)\s*(?:ш|шт|pcs?|pieces?)\b/i,
];

const COACHING_PATTERNS = [
  /кало?ри\s*(үлд|left|remain)/i,
  /calories?\s*(left|remain)/i,
  /хэдэн\s*кало?ри/i,
  /how\s*many\s*calori/i,
  /what\s*(should|can)\s*i\s*eat/i,
  /юу\s*идэх/i,
  /өнөөдөр/i,
  /today/i,
];

function isCoachingQuery(text: string): boolean {
  return COACHING_PATTERNS.some((p) => p.test(text));
}

function parseQuantity(segment: string): { name: string; grams: number } {
  let grams = 100;
  let name = segment.trim();

  for (const pattern of QUANTITY_PATTERNS) {
    const match = name.match(pattern);
    if (match) {
      const val = parseFloat(match[1].replace(',', '.'));
      if (pattern.source.includes('кг|kg')) {
        grams = val * 1000;
      } else if (pattern.source.includes('ш|шт')) {
        grams = val * 100;
      } else {
        grams = val;
      }
      name = name.replace(match[0], '').trim();
      break;
    }
  }

  const simpleNum = name.match(/^(\d+)\s+(.+)$/);
  if (simpleNum) {
    grams = parseInt(simpleNum[1], 10);
    name = simpleNum[2].trim();
  }

  return { name: name || segment.trim(), grams };
}

function splitFoodText(text: string): string[] {
  return text
    .split(/[,;+&]|\bба\b|\band\b/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private bot: Telegraf | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly telegramService: TelegramService,
    private readonly mealLogsService: MealLogsService,
    private readonly foodsService: FoodsService,
    private readonly dashboardService: DashboardService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  onModuleInit() {
    const token = this.config.get('TELEGRAM_BOT_TOKEN');
    if (!token) return;

    this.bot = new Telegraf(token);

    this.bot.command('link', (ctx) => this.handleLinkCommand(ctx));
    this.bot.command('status', (ctx) => this.handleStatusCommand(ctx));
    this.bot.on('text', (ctx) => this.handleTextMessage(ctx));
    this.bot.on('callback_query', (ctx) => this.handleCallbackQuery(ctx));

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
        'Send /link followed by your 6-digit code from the Coach app.\nExample: /link 123456',
      );
      return;
    }

    const from = ctx.from;
    const chat = ctx.chat;
    if (!from || !chat) return;

    try {
      await this.telegramService.confirmLink(
        String(from.id),
        String(chat.id),
        code,
        from.username,
      );
      await ctx.reply('Account linked successfully! You can now log meals by sending text messages.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to link account';
      await ctx.reply(`Error: ${msg}`);
    }
  }

  private async handleStatusCommand(ctx: Context) {
    const from = ctx.from;
    if (!from) return;

    const userId = await this.telegramService.findUserByTelegram(String(from.id));
    if (!userId) {
      await ctx.reply('Your account is not linked. Use /link <code> to connect.');
      return;
    }

    await this.handleCoachingQuery(ctx, userId);
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

    const userId = await this.telegramService.findUserByTelegram(String(telegramUserId));
    if (!userId) {
      await ctx.reply(
        'Please link your account first. In the Coach app, go to Settings → Telegram.',
      );
      return;
    }

    const text = msg.text.trim();
    if (!text) return;

    if (isCoachingQuery(text)) {
      await this.handleCoachingQuery(ctx, userId);
      return;
    }

    await this.handleFoodLogging(ctx, userId, text, idempotencyKey);
  }

  private async handleCoachingQuery(ctx: Context, userId: string) {
    try {
      const dashboard = await this.dashboardService.getDailyDashboard(userId);

      const remaining = dashboard.remaining;
      const consumed = dashboard.consumed;
      const targets = dashboard.targets;

      if (!targets) {
        await ctx.reply('You haven\'t set your nutrition targets yet. Complete onboarding in the app first.');
        return;
      }

      const lines = [
        `📊 Today's Summary`,
        ``,
        `🔥 Calories: ${consumed.calories} / ${targets.calories} (${remaining!.calories} left)`,
        `💪 Protein: ${consumed.protein}g / ${targets.protein}g`,
        `🍞 Carbs: ${consumed.carbs}g / ${targets.carbs}g`,
        `🥑 Fat: ${consumed.fat}g / ${targets.fat}g`,
        ``,
        `📝 Meals logged: ${dashboard.mealCount}`,
      ];

      if (remaining && remaining.calories > 200) {
        lines.push('');
        lines.push(`💡 You have ${remaining.calories} cal left. Try logging a meal!`);
      } else if (remaining && remaining.calories <= 0) {
        lines.push('');
        lines.push('✅ You\'ve hit your calorie target for today!');
      }

      await ctx.reply(lines.join('\n'));
    } catch {
      await ctx.reply('Could not load your dashboard. Please try again.');
    }
  }

  private async handleFoodLogging(
    ctx: Context,
    userId: string,
    text: string,
    idempotencyKey: string,
  ) {
    const segments = splitFoodText(text);
    const parsedItems: ParsedItem[] = segments.map((seg) => {
      const { name, grams } = parseQuantity(seg);
      return { name, quantityGrams: grams };
    });

    const matchedItems: Array<{
      foodId: string;
      servingId: string;
      quantity: number;
      displayName: string;
      calories: number;
    }> = [];

    const unmatchedItems: ParsedItem[] = [];

    for (const item of parsedItems) {
      try {
        const result = await this.foodsService.findMany({
          search: item.name,
          page: 1,
          limit: 1,
          status: 'approved',
        });

        if (result.data.length > 0) {
          const food = result.data[0];
          const serving = food.servings[0];
          if (serving) {
            const gramsPerUnit = Number(serving.gramsPerUnit) || 100;
            const quantity = item.quantityGrams / gramsPerUnit;
            const factor = item.quantityGrams / 100;
            const cal = food.nutrients
              ? Math.round(Number(food.nutrients.caloriesPer100g) * factor)
              : 0;

            matchedItems.push({
              foodId: food.id,
              servingId: serving.id,
              quantity: Math.round(quantity * 10) / 10 || 1,
              displayName: food.normalizedName,
              calories: cal,
            });
            continue;
          }
        }
      } catch {
        // Fall through to unmatched
      }
      unmatchedItems.push(item);
    }

    if (matchedItems.length > 0) {
      const lines = matchedItems.map(
        (m) => `• ${m.displayName} (${m.calories} cal)`,
      );

      if (unmatchedItems.length > 0) {
        lines.push('');
        lines.push('Could not find:');
        unmatchedItems.forEach((u) => lines.push(`• ${u.name}`));
      }

      const messageText = `Found:\n${lines.join('\n')}\n\nConfirm to log?`;

      const callbackData = JSON.stringify({
        action: 'confirm_log',
        userId,
        items: matchedItems.map((m) => ({
          foodId: m.foodId,
          servingId: m.servingId,
          quantity: m.quantity,
        })),
      });

      if (callbackData.length > 64) {
        try {
          await this.mealLogsService.createFromFood(userId, {
            source: 'telegram',
            items: matchedItems.map((m) => ({
              foodId: m.foodId,
              servingId: m.servingId,
              quantity: m.quantity,
            })),
          });

          const response = `✅ Logged:\n${lines.join('\n')}`;
          await this.idempotencyService.store(
            idempotencyKey,
            { status: 200, body: response },
            IDEMPOTENCY_TTL_MINUTES,
          );
          await ctx.reply(response);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Failed to log meal';
          await ctx.reply(`Error: ${msg}`);
        }
      } else {
        await ctx.reply(messageText, {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Confirm', callback_data: callbackData },
                { text: '❌ Cancel', callback_data: 'cancel_log' },
              ],
            ],
          },
        });
      }
    } else {
      const calMatch = text.match(/(\d+)\s*(?:cal|kcal|калори)?/i);
      const calories = calMatch ? parseInt(calMatch[1], 10) : 0;

      if (calories > 0) {
        await this.mealLogsService.quickAdd(userId, {
          calories,
          proteinGrams: 0,
          carbsGrams: 0,
          fatGrams: 0,
          note: text,
          source: 'telegram',
        });

        const response = `✅ Quick logged: ${text} (${calories} cal)`;
        await this.idempotencyService.store(
          idempotencyKey,
          { status: 200, body: response },
          IDEMPOTENCY_TTL_MINUTES,
        );
        await ctx.reply(response);
      } else {
        await ctx.reply(
          `Could not find foods matching "${text}". Try:\n` +
            '• "chicken breast 200g, rice 150g"\n' +
            '• "500 cal lunch"\n' +
            '• "calories left" to check your daily status',
        );
      }
    }
  }

  private async handleCallbackQuery(ctx: Context) {
    const callbackQuery = ctx.callbackQuery;
    if (!callbackQuery || !('data' in callbackQuery)) return;

    const data = callbackQuery.data;

    if (data === 'cancel_log') {
      await ctx.answerCbQuery('Cancelled');
      await ctx.editMessageText('❌ Logging cancelled.');
      return;
    }

    try {
      const parsed = JSON.parse(data) as {
        action: string;
        userId: string;
        items: Array<{ foodId: string; servingId: string; quantity: number }>;
      };

      if (parsed.action === 'confirm_log') {
        await this.mealLogsService.createFromFood(parsed.userId, {
          source: 'telegram',
          items: parsed.items,
        });

        await ctx.answerCbQuery('Logged!');
        await ctx.editMessageText('✅ Meal logged successfully!');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to log';
      await ctx.answerCbQuery(`Error: ${msg}`);
    }
  }
}
