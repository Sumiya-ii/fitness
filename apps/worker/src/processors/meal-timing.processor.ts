import { Job } from 'bullmq';
import OpenAI from 'openai';
import { Telegraf } from 'telegraf';
import { sendExpoPush } from '../expo-push';

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
- Warm mentor-style — never shame, always supportive
- Concrete and data-driven — mention specific times or percentages

Message structure (3–5 sentences, no headers or bullet points):
1. Highlight the most notable meal-timing pattern from the data
2. Explain briefly why it matters (circadian alignment, energy, metabolism)
3. Give ONE practical action for the coming week

Rules:
- Reference real numbers from the data
- Breakfast skipping on weekdays is a top-priority insight
- Late-night eating (after 20:00) is the second-priority insight
- Eating window length is the third priority
- If everything looks healthy, celebrate it warmly
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
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildPrompt(job.data) },
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    const fallback =
      locale === 'mn'
        ? 'Өнгөрсөн долоо хоногийн хоол идэх хэвшлийн дүн шинжилгээ бэлэн боллоо. Энэ долоо хоногт эрүүл хэвшлийг үргэлжлүүлэцгээе!'
        : 'Your weekly meal-timing insight is ready. Keep building healthy habits this week!';

    message = response.choices[0]?.message?.content?.trim() ?? fallback;
  } catch (err) {
    console.error('[MealTiming] OpenAI error:', err);
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

  const results = await Promise.allSettled([
    hasTelegram ? sendTelegram(chatId!, message) : Promise.resolve(),
    hasPush
      ? sendExpoPush(pushTokens, title, message, {
          type: 'meal_timing_insights',
          screen: 'CoachChat',
        })
      : Promise.resolve(),
  ]);

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error(`[MealTiming] Delivery error for user ${userId}:`, result.reason);
    }
  }

  console.log(`[MealTiming] Sent to user ${userId} (telegram=${hasTelegram}, push=${hasPush})`);
}
