import { Job } from 'bullmq';
import { Telegraf } from 'telegraf';

interface ReminderJobData {
  userId: string;
  type: 'morning' | 'evening';
  channels: string[];
  chatId?: string;
  locale?: string;
}

const MORNING_MESSAGES: Record<string, string> = {
  mn: 'Өглөөний мэнд! Өнөөдрийн хоолоо бүртгэхээ бүү мартаарай. 💪',
  en: "Good morning! Don't forget to log your meals today. 💪",
};

const EVENING_MESSAGES: Record<string, string> = {
  mn: 'Оройн мэнд! Өнөөдөр хоол бүртгэлээгүй байна. Одоо бүртгэх үү?',
  en: "Good evening! You haven't logged any meals today. Want to log now?",
};

export async function processReminderJob(job: Job<ReminderJobData>): Promise<void> {
  const { userId, type, channels, chatId, locale } = job.data;

  if (!channels.includes('telegram')) {
    console.log(`[Reminders] User ${userId}: no telegram channel, skipping`);
    return;
  }

  if (!chatId) {
    console.log(`[Reminders] User ${userId}: no chatId in job data, skipping`);
    return;
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.warn('[Reminders] TELEGRAM_BOT_TOKEN not set, skipping');
    return;
  }

  const lang = locale ?? 'mn';
  const messages = type === 'morning' ? MORNING_MESSAGES : EVENING_MESSAGES;
  const message = messages[lang] ?? messages.en;

  const bot = new Telegraf(botToken);
  await bot.telegram.sendMessage(chatId, message);

  console.log(`[Reminders] Sent ${type} reminder to user ${userId} via Telegram`);
}
