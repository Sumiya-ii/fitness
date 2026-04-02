import { Job } from 'bullmq';
import OpenAI from 'openai';
import { Telegraf } from 'telegraf';
import * as Sentry from '@sentry/node';
import { sendExpoPush } from '../expo-push';
import { logMessage } from '../message-log.service';
import { COACH_SYSTEM_PROMPT } from './coach-persona';

interface AdaptiveTargetJobData {
  userId: string;
  channels: string[];
  chatId?: string;
  locale?: string;
  pushTokens?: string[];
  adjustmentKcal: number; // +150 or -100 (or symmetric for gain)
  newCalorieTarget: number;
  goalType: string;
  reason: 'too_fast' | 'too_slow';
  /** Optional: user's first name */
  userName?: string;
  /** Optional: recent weight trend, e.g. "74.5kg → 73.2kg over 2 weeks" */
  weightTrend?: string;
}

interface LocalizedMessage {
  title: string;
  body: string;
}

// ── Static fallbacks ──────────────────────────────────────────────────────────

function buildFallbackMessage(data: AdaptiveTargetJobData): LocalizedMessage {
  const lang = data.locale ?? 'mn';
  const kcal = Math.abs(data.adjustmentKcal);
  const direction = data.adjustmentKcal > 0 ? 'нэмлээ' : 'хасав';
  const directionEn = data.adjustmentKcal > 0 ? 'increased' : 'reduced';

  if (lang === 'en') {
    if (data.reason === 'too_fast') {
      return {
        title: 'Coach adjusted your target 📈',
        body: `Great progress, but let's slow down a bit to protect muscle. Daily target ${directionEn} by ${kcal} kcal to ${data.newCalorieTarget} kcal. Sustainable wins.`,
      };
    }
    return {
      title: 'Coach tweaked your target 🔄',
      body: `Things have been slower than expected. Daily target ${directionEn} by ${kcal} kcal to ${data.newCalorieTarget} kcal. Small shift, big difference.`,
    };
  }

  // Default: Mongolian
  if (data.reason === 'too_fast') {
    return {
      title: 'Coach зорилтыг тохируулав 📈',
      body: `Сайн явж байна, гэхдээ булчингаа хамгаалахын тулд бага зэрэг аажмаар. Өдрийн зорилт ${kcal} ккал ${direction} — одоо ${data.newCalorieTarget} ккал. Тогтвортой ялалт.`,
    };
  }
  return {
    title: 'Coach зорилтыг тохируулав 🔄',
    body: `Ахиц удаашилсан байна. Өдрийн зорилт ${kcal} ккал ${direction} — одоо ${data.newCalorieTarget} ккал. Жижиг өөрчлөлт, том ялгаа.`,
  };
}

// ── AI generation ─────────────────────────────────────────────────────────────

async function generateAdaptiveTargetMessage(
  openai: OpenAI,
  data: AdaptiveTargetJobData,
): Promise<LocalizedMessage | null> {
  const lang = data.locale === 'en' ? 'en' : 'mn';
  const kcal = Math.abs(data.adjustmentKcal);
  const direction =
    data.adjustmentKcal > 0
      ? lang === 'mn'
        ? 'нэмлээ'
        : 'increased'
      : lang === 'mn'
        ? 'хасав'
        : 'reduced';

  const reasonExplanation =
    data.reason === 'too_fast'
      ? lang === 'mn'
        ? 'Хэтэрхий хурдан явж байна — булчингаа хамгаалах хэрэгтэй'
        : 'Progress is too fast — muscle protection needed'
      : lang === 'mn'
        ? 'Ахиц удаашилсан байна — бага зэрэг тохируулах хэрэгтэй'
        : 'Progress is slower than expected — a small nudge will help';

  const contextLines = [
    `User locale: ${lang}`,
    data.userName ? `User's name: ${data.userName}` : null,
    `Goal type: ${data.goalType}`,
    `Reason for adjustment: ${reasonExplanation}`,
    `Adjustment: ${kcal} kcal ${direction}`,
    `New daily calorie target: ${data.newCalorieTarget} kcal`,
    data.weightTrend ? `Weight trend: ${data.weightTrend}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const instruction =
    lang === 'mn'
      ? `Coach зорилтыг яагаад өөрчилсөнийг хүн шиг тайлбарла. Тоонуудыг оруул. Итгэлтэй, халуун дотно байдлаар. 2-3 өгүүлбэр.`
      : `Explain in human terms why the calorie target was adjusted. Include the numbers. Be confident and warm. 2-3 sentences.`;

  const userPrompt = [
    contextLines,
    '',
    instruction,
    '',
    'Return ONLY valid JSON: {"title":"...","body":"..."}',
    'The title is a 4-6 word push notification title. The body is the message text.',
  ].join('\n');

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: COACH_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 200,
      temperature: 0.7,
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

async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.warn('[AdaptiveTarget] TELEGRAM_BOT_TOKEN not set, skipping Telegram delivery');
    return;
  }
  const bot = new Telegraf(botToken);
  await bot.telegram.sendMessage(chatId, text);
}

// ── Main processor ────────────────────────────────────────────────────────────

export async function processAdaptiveTargetJob(job: Job<AdaptiveTargetJobData>): Promise<void> {
  const data = job.data;
  const { userId, channels, chatId, pushTokens = [] } = data;

  const hasTelegram = channels.includes('telegram') && Boolean(chatId);
  const hasPush = channels.includes('push') && pushTokens.length > 0;

  if (!hasTelegram && !hasPush) {
    console.log(`[AdaptiveTarget] User ${userId}: no deliverable channels, skipping notification`);
    return;
  }

  // ── Attempt AI generation ─────────────────────────────────────────────────
  let message: LocalizedMessage | undefined;

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    const openai = new OpenAI({ apiKey: openaiKey });
    const aiMessage = await generateAdaptiveTargetMessage(openai, data);
    if (aiMessage) {
      message = aiMessage;
      console.log(`[AdaptiveTarget] AI-generated message for user ${userId}`);
    } else {
      console.warn(
        `[AdaptiveTarget] AI generation returned empty for user ${userId}, using fallback`,
      );
    }
  } else {
    console.warn('[AdaptiveTarget] OPENAI_API_KEY not set, using static fallback');
  }

  if (!message) {
    message = buildFallbackMessage(data);
  }

  const sharedLogFields = {
    userId,
    messageType: 'adaptive_target',
    content: message.body,
    jobId: job.id,
    metadata: {
      reason: data.reason,
      adjustmentKcal: data.adjustmentKcal,
      newCalorieTarget: data.newCalorieTarget,
      goalType: data.goalType,
    },
  };

  const deliveries: Promise<void>[] = [];

  if (hasTelegram) {
    deliveries.push(
      (async () => {
        const start = Date.now();
        try {
          await sendTelegramMessage(chatId!, message!.body);
          await logMessage({
            ...sharedLogFields,
            channel: 'telegram',
            status: 'sent',
            deliveryMs: Date.now() - start,
          });
        } catch (err) {
          console.error(`[AdaptiveTarget] Telegram delivery error for user ${userId}:`, err);
          Sentry.captureException(err, {
            tags: { processor: 'adaptive_target', stage: 'telegram_delivery' },
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
            type: 'adaptive_target',
            adjustmentKcal: data.adjustmentKcal,
            newCalorieTarget: data.newCalorieTarget,
          });
          await logMessage({
            ...sharedLogFields,
            channel: 'push',
            status: 'sent',
            deliveryMs: Date.now() - start,
          });
        } catch (err) {
          console.error(`[AdaptiveTarget] Push delivery error for user ${userId}:`, err);
          Sentry.captureException(err, {
            tags: { processor: 'adaptive_target', stage: 'push_delivery' },
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
    `[AdaptiveTarget] Notified user ${userId}: ${data.reason}, adjustment=${data.adjustmentKcal > 0 ? '+' : ''}${data.adjustmentKcal} kcal → ${data.newCalorieTarget} kcal/day`,
  );
}
