import { Job } from 'bullmq';
import { Telegraf } from 'telegraf';
import * as Sentry from '@sentry/node';
import { sendExpoPush } from '../expo-push';
import { logMessage } from '../message-log.service';

interface MealNudgeJobData {
  userId: string;
  channels: string[];
  chatId?: string;
  locale?: string;
  pushTokens?: string[];
  mealCount: number;
}

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

function getNudgeMessage(lang: string): { title: string; body: string } {
  const variants = lang === 'en' ? NUDGE_VARIANTS_EN : NUDGE_VARIANTS_MN;
  return variants[Math.floor(Math.random() * variants.length)]!;
}

export async function processMealNudgeJob(job: Job<MealNudgeJobData>): Promise<void> {
  const { userId, channels, chatId, locale, pushTokens = [] } = job.data;

  const lang = locale ?? 'mn';
  const message = getNudgeMessage(lang);

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
          await bot.telegram.sendMessage(chatId!, message.body);
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
          await sendExpoPush(pushTokens, message.title, message.body, {
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
