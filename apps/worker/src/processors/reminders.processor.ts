import { Job } from 'bullmq';
import { Telegraf } from 'telegraf';
import * as Sentry from '@sentry/node';
import { sendExpoPush } from '../expo-push';
import { logMessage } from '../message-log.service';

interface ReminderJobData {
  userId: string;
  type: 'morning' | 'evening';
  channels: string[];
  chatId?: string;
  locale?: string;
  pushTokens?: string[];
}

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

function getReminderMessage(
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

export async function processReminderJob(job: Job<ReminderJobData>): Promise<void> {
  const { userId, type, channels, chatId, locale, pushTokens = [] } = job.data;

  const lang = locale ?? 'mn';
  const message = getReminderMessage(type, lang);

  const hasTelegram = channels.includes('telegram') && Boolean(chatId);
  const hasPush = channels.includes('push') && pushTokens.length > 0;

  if (!hasTelegram && !hasPush) {
    console.log(`[Reminders] User ${userId}: no deliverable channels, skipping`);
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
          await sendTelegramReminder(userId, chatId!, message.body);
          await logMessage({
            ...sharedLogFields,
            channel: 'telegram',
            status: 'sent',
            deliveryMs: Date.now() - start,
          });
        } catch (err) {
          console.error(`[Reminders] Telegram delivery error for user ${userId}:`, err);
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
          await sendExpoPush(pushTokens, message.title, message.body, { type: 'reminder' });
          await logMessage({
            ...sharedLogFields,
            channel: 'push',
            status: 'sent',
            deliveryMs: Date.now() - start,
          });
        } catch (err) {
          console.error(`[Reminders] Push delivery error for user ${userId}:`, err);
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

  console.log(
    `[Reminders] Sent ${type} reminder to user ${userId} (telegram=${hasTelegram}, push=${hasPush})`,
  );
}

async function sendTelegramReminder(userId: string, chatId: string, text: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.warn('[Reminders] TELEGRAM_BOT_TOKEN not set, skipping Telegram delivery');
    return;
  }
  const bot = new Telegraf(botToken);
  await bot.telegram.sendMessage(chatId, text);
  console.log(`[Reminders] Telegram reminder sent to user ${userId}`);
}
