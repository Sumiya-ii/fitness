import { Job } from 'bullmq';
import { Telegraf } from 'telegraf';
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

const MORNING_MESSAGES: Record<string, { title: string; body: string }> = {
  mn: {
    title: 'Өглөөний мэнд! 💪',
    body: 'Өнөөдрийн хоолоо бүртгэхээ бүү мартаарай.',
  },
  en: {
    title: 'Good morning! 💪',
    body: "Don't forget to log your meals today.",
  },
};

const EVENING_MESSAGES: Record<string, { title: string; body: string }> = {
  mn: {
    title: 'Оройн мэнд!',
    body: 'Өнөөдөр хоол бүртгэлээгүй байна. Одоо бүртгэх үү?',
  },
  en: {
    title: 'Good evening!',
    body: "You haven't logged any meals today. Want to log now?",
  },
};

export async function processReminderJob(job: Job<ReminderJobData>): Promise<void> {
  const { userId, type, channels, chatId, locale, pushTokens = [] } = job.data;

  const lang = locale ?? 'mn';
  const messageMap = type === 'morning' ? MORNING_MESSAGES : EVENING_MESSAGES;
  const message = messageMap[lang] ?? messageMap['en']!;

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
