import { Job } from 'bullmq';
import OpenAI from 'openai';
import { Telegraf } from 'telegraf';
import * as Sentry from '@sentry/node';
import { sendExpoPush } from '../expo-push';
import { logMessage } from '../message-log.service';
import { COACH_SYSTEM_PROMPT } from './coach-persona';

interface MealNudgeJobData {
  userId: string;
  channels: string[];
  chatId?: string;
  locale?: string;
  pushTokens?: string[];
  mealCount: number;
  /** Optional: names/types of meals already logged today */
  loggedMeals?: string[];
  /** Optional: user's first name */
  userName?: string;
  /** Optional: current local time (HH:mm) for contextual nudge */
  localTime?: string;
  /** Optional: typical meal for this time of day, from user memory */
  typicalMealAtThisTime?: string;
}

// ── Static fallbacks ──────────────────────────────────────────────────────────

const NUDGE_VARIANTS_MN: Array<{ title: string; body: string }> = [
  {
    title: 'Оройн хоолонд юу идсэн бэ? 🍜',
    body: 'Өнөөдөр нэг л хоол бүртгэгдсэн. Оройн хоолоо нэмэх үү?',
  },
  {
    title: 'Хоолны бүртгэл дутуу байна 📝',
    body: 'Бүртгэл тогтвортой байх тусам зорилтод ойртоно. Юу идсэнээ нэмэх үү?',
  },
  {
    title: 'Өнөөдрийн хоол сонирхолтой байна 🤔',
    body: 'Нэг хоол бүртгэгдсэн — үлдсэнийг нь нэмэх үү?',
  },
];

const NUDGE_VARIANTS_EN: Array<{ title: string; body: string }> = [
  {
    title: "What's for dinner? 🍜",
    body: 'Only one meal logged today. Want to add the rest?',
  },
  {
    title: 'Your log is looking light 📝',
    body: 'Consistent logging = better results. What else did you eat today?',
  },
  {
    title: "Today's meals look interesting 🤔",
    body: 'One meal down — want to add the rest?',
  },
];

function getFallbackNudge(lang: string): { title: string; body: string } {
  const variants = lang === 'en' ? NUDGE_VARIANTS_EN : NUDGE_VARIANTS_MN;
  return variants[Math.floor(Math.random() * variants.length)]!;
}

// ── AI generation ─────────────────────────────────────────────────────────────

async function generateNudgeMessage(
  openai: OpenAI,
  data: MealNudgeJobData,
): Promise<{ title: string; body: string } | null> {
  const lang = data.locale === 'en' ? 'en' : 'mn';
  const name = data.userName ?? null;

  const loggedMealsText =
    data.loggedMeals && data.loggedMeals.length > 0 ? data.loggedMeals.join(', ') : null;

  const contextLines = [
    `Message type: meal_nudge`,
    `User locale: ${lang}`,
    name ? `User's name: ${name}` : null,
    data.localTime ? `Current local time: ${data.localTime}` : null,
    `Meals logged today: ${data.mealCount}`,
    loggedMealsText ? `What they logged: ${loggedMealsText}` : null,
    data.typicalMealAtThisTime
      ? `What they typically eat at this time: ${data.typicalMealAtThisTime}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  const instruction =
    lang === 'mn'
      ? 'Хоол бүртгэхийг сануулах богино, сонирхлыг татсан мессеж бич. Буруутгалгүй, зөвхөн "Юу идсэн бэ?" гэсэн мэдрэмжтэй байх. 2 өгүүлбэр хангалттай.'
      : 'Write a short, curiosity-driven meal nudge. Never guilty — just "What did you eat?" energy. 2 sentences is enough.';

  const userPrompt = [
    contextLines,
    '',
    instruction,
    '',
    'Return ONLY valid JSON: {"title":"...","body":"..."}',
    'The title is a 3-5 word push notification title. The body is the message text.',
  ].join('\n');

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

// ── Main processor ────────────────────────────────────────────────────────────

export async function processMealNudgeJob(job: Job<MealNudgeJobData>): Promise<void> {
  const { userId, channels, chatId, locale, pushTokens = [] } = job.data;

  const lang = locale ?? 'mn';

  // ── Attempt AI generation ─────────────────────────────────────────────────
  let message: { title: string; body: string } | undefined;

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    const openai = new OpenAI({ apiKey: openaiKey });
    const aiMessage = await generateNudgeMessage(openai, job.data);
    if (aiMessage) {
      message = aiMessage;
      console.log(`[MealNudge] AI-generated nudge for user ${userId}`);
    } else {
      console.warn(`[MealNudge] AI generation returned empty for user ${userId}, using fallback`);
    }
  } else {
    console.warn('[MealNudge] OPENAI_API_KEY not set, using static fallback');
  }

  if (!message) {
    message = getFallbackNudge(lang);
  }

  const hasTelegram = channels.includes('telegram') && Boolean(chatId);
  const hasPush = channels.includes('push') && pushTokens.length > 0;

  if (!hasTelegram && !hasPush) {
    console.log(`[MealNudge] User ${userId}: no deliverable channels, skipping`);
    return;
  }

  const sharedLogFields = {
    userId,
    messageType: 'meal_nudge' as const,
    content: message.body,
    jobId: job.id,
  };

  const deliveries: Promise<void>[] = [];

  if (hasTelegram) {
    deliveries.push(
      (async () => {
        const start = Date.now();
        try {
          const botToken = process.env.TELEGRAM_BOT_TOKEN;
          if (!botToken) {
            console.warn('[MealNudge] TELEGRAM_BOT_TOKEN not set, skipping Telegram delivery');
            return;
          }
          const bot = new Telegraf(botToken);
          await bot.telegram.sendMessage(chatId!, message!.body);
          await logMessage({
            ...sharedLogFields,
            channel: 'telegram',
            status: 'sent',
            deliveryMs: Date.now() - start,
          });
        } catch (err) {
          console.error(`[MealNudge] Telegram delivery error for user ${userId}:`, err);
          Sentry.captureException(err, {
            tags: { processor: 'meal_nudge', stage: 'telegram_delivery' },
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
          await sendExpoPush(pushTokens, message!.title, message!.body, {
            type: 'meal_nudge',
            screen: 'Log',
          });
          await logMessage({
            ...sharedLogFields,
            channel: 'push',
            status: 'sent',
            deliveryMs: Date.now() - start,
          });
        } catch (err) {
          console.error(`[MealNudge] Push delivery error for user ${userId}:`, err);
          Sentry.captureException(err, {
            tags: { processor: 'meal_nudge', stage: 'push_delivery' },
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

  console.log(
    `[MealNudge] Sent nudge to user ${userId} (telegram=${hasTelegram}, push=${hasPush})`,
  );
}
