import { Job } from 'bullmq';
import OpenAI from 'openai';
import { Pool } from 'pg';
import { Telegraf } from 'telegraf';
import * as Sentry from '@sentry/node';
import { sendExpoPush } from '../expo-push';
import { logMessage } from '../message-log.service';
import { logger } from '../logger';

const DEFAULT_TIMEZONE = 'Asia/Ulaanbaatar';
/** Delivery window: 7 AM – 10 PM in the user's local timezone */
const DELIVERY_WINDOW_START = 7;
const DELIVERY_WINDOW_END = 22;

/** Returns the user's local hour (0–23) for the given IANA timezone string. */
function localHour(timezone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    }).formatToParts(new Date());
    const hourPart = parts.find((p) => p.type === 'hour');
    const h = parseInt(hourPart?.value ?? '0', 10);
    // Intl hour12:false returns 0–23; '24' can appear for midnight in some locales
    return h === 24 ? 0 : h;
  } catch {
    // Unknown timezone — fall back to UTC hour
    return new Date().getUTCHours();
  }
}

async function fetchUserTimezone(pool: Pool, userId: string): Promise<string> {
  const result = await pool.query<{ timezone: string }>(
    `SELECT COALESCE(timezone, $2) AS timezone FROM profiles WHERE user_id = $1 LIMIT 1`,
    [userId, DEFAULT_TIMEZONE],
  );
  return result.rows[0]?.timezone ?? DEFAULT_TIMEZONE;
}

const COACH_SYSTEM_PROMPT =
  'You are Coach, a concise Mongolian nutrition coach. Write warm, practical reminders in the user locale.';

interface ReminderJobData {
  userId: string;
  type: 'morning' | 'evening';
  channels: string[];
  chatId?: string;
  locale?: string;
  pushTokens?: string[];
  /** Optional: yesterday's calorie total passed from the scheduler for context */
  yesterdayCalories?: number;
  /** Optional: user's first name */
  userName?: string;
}

// ── Static fallbacks (used when OpenAI is unavailable) ───────────────────────

const MORNING_VARIANTS_MN: Array<{ title: string; body: string }> = [
  {
    title: 'Өглөөний мэнд! 🌅',
    body: 'Шинэ өдөр, шинэ боломж. Өглөөний цайгаа юу болгох вэ?',
  },
  {
    title: 'Өглөө болж байна! ☀️',
    body: 'Өнөөдөр юу идэхээ төлөвлөж байна уу? Coach бэлэн.',
  },
  {
    title: 'Сайн уу! 💪',
    body: 'Өчигдөр сайн хоол бүртгэсэн. Өнөөдөр ч тэгцгээе!',
  },
];

const MORNING_VARIANTS_EN: Array<{ title: string; body: string }> = [
  {
    title: 'Good morning! 🌅',
    body: "New day, fresh start. What's the breakfast plan?",
  },
  {
    title: 'Rise and shine! ☀️',
    body: "What's on the menu today? Coach is ready when you are.",
  },
  {
    title: 'Morning! 💪',
    body: "You logged well yesterday. Let's keep the momentum going!",
  },
];

const EVENING_VARIANTS_MN: Array<{ title: string; body: string }> = [
  {
    title: 'Оройн мэнд! 🌙',
    body: 'Өнөөдрийн хоолоо бүртгэхээ мартсан уу? Орохоосоо өмнө нэмж болно.',
  },
  {
    title: 'Өдөр дуусаж байна 📊',
    body: 'Өнөөдрийн хоолоо нэмвэл бүрэн зураг харагдана.',
  },
];

const EVENING_VARIANTS_EN: Array<{ title: string; body: string }> = [
  {
    title: 'Good evening! 🌙',
    body: "Forgot to log today? There's still time before bed.",
  },
  {
    title: "Day's wrapping up 📊",
    body: 'Add your meals to see the full picture of today.',
  },
];

function getFallbackMessage(
  type: 'morning' | 'evening',
  lang: string,
): { title: string; body: string } {
  const variants =
    type === 'morning'
      ? lang === 'en'
        ? MORNING_VARIANTS_EN
        : MORNING_VARIANTS_MN
      : lang === 'en'
        ? EVENING_VARIANTS_EN
        : EVENING_VARIANTS_MN;
  return variants[Math.floor(Math.random() * variants.length)]!;
}

// ── AI generation ─────────────────────────────────────────────────────────────

async function generateReminderMessage(
  openai: OpenAI,
  data: ReminderJobData,
  today: string,
): Promise<{ title: string; body: string } | null> {
  const lang = data.locale === 'en' ? 'en' : 'mn';
  const name = data.userName ? data.userName : null;
  const greeting = data.type === 'morning' ? 'morning' : 'evening';

  const yesterdayContext =
    data.yesterdayCalories !== undefined
      ? lang === 'mn'
        ? `Өчигдөр ${data.yesterdayCalories} ккал бүртгэсэн.`
        : `Yesterday they logged ${data.yesterdayCalories} kcal.`
      : null;

  const userPrompt = [
    `Reminder type: ${greeting}`,
    `User locale: ${lang}`,
    `Today's date: ${today}`,
    name ? `User's name: ${name}` : 'User name: unknown',
    yesterdayContext,
    '',
    lang === 'mn'
      ? `${greeting === 'morning' ? 'Өглөөний' : 'Оройн'} мэндчилгээ бич. Богино, дулаан, 2 өгүүлбэр хангалттай.`
      : `Write a ${greeting} reminder message. Keep it short and warm — 2 sentences is perfect.`,
    '',
    'Return ONLY valid JSON: {"title":"...","body":"..."}',
    'The title should be 3-5 words max (notification title). The body is the message text.',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: COACH_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 150,
      temperature: 0.8,
      response_format: { type: 'json_object' },
    });

    const raw = response.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw) as { title?: string; body?: string };

    if (!parsed.title || !parsed.body) return null;
    return { title: parsed.title, body: parsed.body };
  } catch {
    return null;
  }
}

// ── Delivery helpers ──────────────────────────────────────────────────────────

async function sendTelegramReminder(userId: string, chatId: string, text: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    logger.warn('[Reminders] TELEGRAM_BOT_TOKEN not set, skipping Telegram delivery');
    return;
  }
  const bot = new Telegraf(botToken);
  await bot.telegram.sendMessage(chatId, text);
  logger.info({ userId }, '[Reminders] Telegram reminder sent');
}

// ── Main processor ────────────────────────────────────────────────────────────

export async function processReminderJob(job: Job<ReminderJobData>): Promise<void> {
  const { userId, type, channels, chatId, locale, pushTokens = [] } = job.data;

  const lang = locale ?? 'mn';

  // ── Timezone delivery window check ────────────────────────────────────────
  // Fetch the user's IANA timezone from profiles. Default: Asia/Ulaanbaatar.
  // Skip delivery if the user's local hour is outside 7 AM – 10 PM.
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    const pool = new Pool({ connectionString: dbUrl });
    try {
      const timezone = await fetchUserTimezone(pool, userId);
      const hour = localHour(timezone);
      if (hour < DELIVERY_WINDOW_START || hour >= DELIVERY_WINDOW_END) {
        logger.info(
          { userId, timezone, localHour: hour },
          '[Reminders] Outside delivery window (7–22 local), skipping',
        );
        return;
      }
    } finally {
      await pool.end();
    }
  }

  // ── Attempt AI generation ─────────────────────────────────────────────────
  let message: { title: string; body: string } | undefined;

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    const openai = new OpenAI({ apiKey: openaiKey, timeout: 60_000 });
    const today = new Date().toISOString().split('T')[0]!;
    const aiMessage = await generateReminderMessage(openai, job.data, today);
    if (aiMessage) {
      message = aiMessage;
      logger.info({ userId, type }, '[Reminders] AI-generated reminder');
    } else {
      logger.warn({ userId }, '[Reminders] AI generation returned empty, using fallback');
    }
  } else {
    logger.warn('[Reminders] OPENAI_API_KEY not set, using static fallback');
  }

  // Fall back to static variant if AI failed or key missing
  if (!message) {
    message = getFallbackMessage(type, lang);
  }

  const hasTelegram = channels.includes('telegram') && Boolean(chatId);
  const hasPush = channels.includes('push') && pushTokens.length > 0;

  if (!hasTelegram && !hasPush) {
    logger.info({ userId }, '[Reminders] No deliverable channels, skipping');
    return;
  }

  const sharedLogFields = {
    userId,
    messageType: `reminder_${type}` as const,
    content: message.body,
    jobId: job.id,
  };

  const deliveries: Promise<void>[] = [];

  if (hasTelegram) {
    deliveries.push(
      (async () => {
        const start = Date.now();
        try {
          await sendTelegramReminder(userId, chatId!, message!.body);
          await logMessage({
            ...sharedLogFields,
            channel: 'telegram',
            status: 'sent',
            deliveryMs: Date.now() - start,
          });
        } catch (err) {
          logger.error(
            { userId, error: err instanceof Error ? err.message : String(err) },
            '[Reminders] Telegram delivery error',
          );
          Sentry.captureException(err, {
            tags: { processor: 'reminders', stage: 'telegram_delivery' },
            extra: { userId, type },
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
          await sendExpoPush(pushTokens, message!.title, message!.body, { type: 'reminder' });
          await logMessage({
            ...sharedLogFields,
            channel: 'push',
            status: 'sent',
            deliveryMs: Date.now() - start,
          });
        } catch (err) {
          logger.error(
            { userId, error: err instanceof Error ? err.message : String(err) },
            '[Reminders] Push delivery error',
          );
          Sentry.captureException(err, {
            tags: { processor: 'reminders', stage: 'push_delivery' },
            extra: { userId, type },
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

  logger.info(
    { userId, type, telegram: hasTelegram, push: hasPush },
    '[Reminders] Reminder dispatched',
  );
}
