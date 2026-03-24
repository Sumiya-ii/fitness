import { Job } from 'bullmq';
import { Telegraf } from 'telegraf';
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

const NUDGE_MESSAGES: Record<string, { title: string; body: string }> = {
  mn: {
    title: 'Хоолоо бүртгэхээ мартсан уу? 🍽️',
    body: 'Та өнөөдөр зөвхөн нэг хоол бүртгэсэн байна. Оройн хоолоо нэмэх үү?',
  },
  en: {
    title: 'Did you forget to log? 🍽️',
    body: "You've only logged one meal today. Want to add dinner?",
  },
};

export async function processMealNudgeJob(job: Job<MealNudgeJobData>): Promise<void> {
  const { userId, channels, chatId, locale, pushTokens = [] } = job.data;

  const lang = locale ?? 'mn';
  const message = NUDGE_MESSAGES[lang] ?? NUDGE_MESSAGES['en']!;

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
