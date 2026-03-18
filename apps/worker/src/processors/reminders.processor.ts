import { Job } from 'bullmq';
import { Telegraf } from 'telegraf';

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

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

async function sendExpoPushNotifications(
  tokens: string[],
  title: string,
  body: string,
): Promise<void> {
  if (tokens.length === 0) return;

  const messages = tokens.map((to) => ({
    to,
    title,
    body,
    sound: 'default' as const,
    data: { type: 'reminder' },
  }));

  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    throw new Error(`Expo Push API error: ${response.status}`);
  }
}

export async function processReminderJob(job: Job<ReminderJobData>): Promise<void> {
  const { userId, type, channels, chatId, locale, pushTokens = [] } = job.data;

  const lang = locale ?? 'mn';
  const messageMap = type === 'morning' ? MORNING_MESSAGES : EVENING_MESSAGES;
  const message = messageMap[lang] ?? messageMap.en;

  const hasTelegram = channels.includes('telegram') && Boolean(chatId);
  const hasPush = channels.includes('push') && pushTokens.length > 0;

  if (!hasTelegram && !hasPush) {
    console.log(`[Reminders] User ${userId}: no deliverable channels, skipping`);
    return;
  }

  const results = await Promise.allSettled([
    hasTelegram ? sendTelegramReminder(userId, chatId!, message.body) : Promise.resolve(),
    hasPush ? sendExpoPushNotifications(pushTokens, message.title, message.body) : Promise.resolve(),
  ]);

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error(`[Reminders] User ${userId}: delivery error:`, result.reason);
    }
  }

  console.log(`[Reminders] Sent ${type} reminder to user ${userId} (telegram=${hasTelegram}, push=${hasPush})`);
}

async function sendTelegramReminder(
  userId: string,
  chatId: string,
  text: string,
): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.warn('[Reminders] TELEGRAM_BOT_TOKEN not set, skipping Telegram delivery');
    return;
  }
  const bot = new Telegraf(botToken);
  await bot.telegram.sendMessage(chatId, text);
  console.log(`[Reminders] Telegram reminder sent to user ${userId}`);
}
