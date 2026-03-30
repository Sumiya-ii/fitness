import { Job } from 'bullmq';
import OpenAI from 'openai';
import { Telegraf } from 'telegraf';
import * as Sentry from '@sentry/node';
import { sendExpoPush } from '../expo-push';
import { logMessage } from '../message-log.service';

// ── Types (mirrors api/src/meal-timing/meal-timing.service.ts) ────────────────

interface MealTimingStat {
  mealType: string;
  avgHour: number;
  count: number;
}

interface MealTimingInsights {
  weekStart: string;
  weekEnd: string;
  mealStats: MealTimingStat[];
  breakfastWeekdayRate: number;
  breakfastWeekendRate: number;
  lateNightEatingDays: number;
  avgEatingWindowMinutes: number | null;
  highlights: string[];
}

interface MealTimingJobData {
  userId: string;
  channels: string[];
  chatId?: string;
  locale?: string;
  pushTokens?: string[];
  userName: string | null;
  insights: MealTimingInsights;
}

// ── System prompt ──────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Coach — a warm, insightful AI nutrition coach for Mongolian users.

Every Monday morning you send users a personalized weekly meal-timing insight.

Your personality:
- Speak Mongolian by default; use English only when locale is 'en'
- Warm mentor-style — never shame, always supportive and curious
- Concrete and data-driven — mention specific times or percentages
- When relevant, reference Mongolian food culture (өглөөний цай is culturally important, шөл in winter makes sense late)

Message structure (3–5 sentences, no headers or bullet points):
1. Highlight the most notable meal-timing pattern with a SPECIFIC number
2. Explain briefly why it matters (energy levels, metabolism, sleep quality) — one sentence max
3. Give ONE practical, actionable tip for the coming week

Rules:
- Reference real numbers from the data (actual times, percentages)
- Priority order: breakfast skipping > late-night eating > eating window length
- If everything looks healthy, celebrate it warmly with the specific numbers
- Frame insights as discoveries, not corrections: "Сонирхолтой нь..." > "Та алдлаа..."
- Keep it under 100 words`;

// ── Prompt builder ─────────────────────────────────────────────────────────────

function buildPrompt(data: MealTimingJobData): string {
  const { insights, userName, locale = 'mn' } = data;
  const name = userName ?? (locale === 'mn' ? 'та' : 'you');

  const mealStatsStr = insights.mealStats
    .map((s) => {
      const h = Math.floor(s.avgHour);
      const m = Math.round((s.avgHour - h) * 60);
      return `${s.mealType}: avg ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} (${s.count} logs)`;
    })
    .join(', ');

  const windowStr =
    insights.avgEatingWindowMinutes !== null
      ? `${Math.floor(insights.avgEatingWindowMinutes / 60)}h ${insights.avgEatingWindowMinutes % 60}m`
      : 'unknown';

  return `
Meal-timing insights for ${name} (locale: ${locale}), week ${insights.weekStart} – ${insights.weekEnd}:
- Breakfast on weekdays: ${insights.breakfastWeekdayRate}% of days
- Breakfast on weekends: ${insights.breakfastWeekendRate}% of days
- Late-night eating days (after 20:00): ${insights.lateNightEatingDays}/7 days
- Avg eating window: ${windowStr}
- Meal averages: ${mealStatsStr || 'no data'}
- Pre-computed highlights: ${insights.highlights.join(' | ')}

Write the meal-timing insight following the system prompt structure.
`.trim();
}

// ── Delivery helpers ───────────────────────────────────────────────────────────

async function sendTelegram(chatId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn('[MealTiming] TELEGRAM_BOT_TOKEN not set, skipping Telegram delivery');
    return;
  }
  const bot = new Telegraf(token);
  await bot.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown' });
}

// ── Main processor ─────────────────────────────────────────────────────────────

export async function processMealTimingJob(job: Job<MealTimingJobData>): Promise<void> {
  const { userId, channels, chatId, locale = 'mn', pushTokens = [] } = job.data;

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    console.warn('[MealTiming] OPENAI_API_KEY not set, skipping');
    return;
  }

  const openai = new OpenAI({ apiKey: openaiKey });

  let message: string;
  let promptTokens: number | undefined;
  let completionTokens: number | undefined;
  let generationMs: number | undefined;

  try {
    const genStart = Date.now();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildPrompt(job.data) },
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    generationMs = Date.now() - genStart;
    promptTokens = response.usage?.prompt_tokens;
    completionTokens = response.usage?.completion_tokens;

    const fallback =
      locale === 'mn'
        ? 'Өнгөрсөн долоо хоногийн хоол идэх хэвшлийн дүн шинжилгээ бэлэн боллоо. Энэ долоо хоногт эрүүл хэвшлийг үргэлжлүүлэцгээе!'
        : 'Your weekly meal-timing insight is ready. Keep building healthy habits this week!';

    message = response.choices[0]?.message?.content?.trim() ?? fallback;
  } catch (err) {
    console.error('[MealTiming] OpenAI error:', err);
    Sentry.captureException(err, {
      tags: { processor: 'meal_timing', stage: 'openai_generation' },
      extra: { userId },
    });
    throw err;
  }

  console.log(`[MealTiming] Generated insight for user ${userId}`);

  const hasTelegram = channels.includes('telegram') && Boolean(chatId);
  const hasPush = channels.includes('push') && pushTokens.length > 0;

  if (!hasTelegram && !hasPush) {
    console.log(`[MealTiming] No deliverable channel for user ${userId}`);
    return;
  }

  const title = locale === 'en' ? 'Meal timing insight 🕐' : 'Хоол идэх цагийн дүн шинжилгээ 🕐';

  const sharedLogFields = {
    userId,
    messageType: 'meal_timing',
    content: message,
    aiModel: 'gpt-4o',
    promptTokens,
    completionTokens,
    generationMs,
    jobId: job.id,
  };

  const deliveries: Promise<void>[] = [];

  if (hasTelegram) {
    deliveries.push(
      (async () => {
        const start = Date.now();
        try {
          await sendTelegram(chatId!, message);
          await logMessage({
            ...sharedLogFields,
            channel: 'telegram',
            status: 'sent',
            deliveryMs: Date.now() - start,
          });
        } catch (err) {
          console.error(`[MealTiming] Telegram delivery error for user ${userId}:`, err);
          Sentry.captureException(err, {
            tags: { processor: 'meal_timing', stage: 'telegram_delivery' },
            extra: { userId },
          });
          await logMessage({
            ...sharedLogFields,
            channel: 'telegram',
            status: 'failed',
            deliveryMs: Date.now() - start,
            errorMessage: err instanceof Error ? err.message : String(err),
          });
        }
      })(),
    );
  }

  if (hasPush) {
    deliveries.push(
      (async () => {
        const start = Date.now();
        try {
          await sendExpoPush(pushTokens, title, message, {
            type: 'meal_timing_insights',
            screen: 'CoachChat',
          });
          await logMessage({
            ...sharedLogFields,
            channel: 'push',
            status: 'sent',
            deliveryMs: Date.now() - start,
          });
        } catch (err) {
          console.error(`[MealTiming] Push delivery error for user ${userId}:`, err);
          Sentry.captureException(err, {
            tags: { processor: 'meal_timing', stage: 'push_delivery' },
            extra: { userId },
          });
          await logMessage({
            ...sharedLogFields,
            channel: 'push',
            status: 'failed',
            deliveryMs: Date.now() - start,
            errorMessage: err instanceof Error ? err.message : String(err),
          });
        }
      })(),
    );
  }

  await Promise.allSettled(deliveries);

  console.log(`[MealTiming] Sent to user ${userId} (telegram=${hasTelegram}, push=${hasPush})`);
}
