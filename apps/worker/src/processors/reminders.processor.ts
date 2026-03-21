import { Job } from 'bullmq';
import { Telegraf } from 'telegraf';
import { sendExpoPush } from '../expo-push';

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

  const results = await Promise.allSettled([
    hasTelegram ? sendTelegramReminder(userId, chatId!, message.body) : Promise.resolve(),
    hasPush
      ? sendExpoPush(pushTokens, message.title, message.body, { type: 'reminder' })
      : Promise.resolve(),
  ]);

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error(`[Reminders] User ${userId}: delivery error:`, result.reason);
    }
  }

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
