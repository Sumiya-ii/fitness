import { Job } from 'bullmq';
import { Telegraf } from 'telegraf';
import * as Sentry from '@sentry/node';
import { sendExpoPush } from '../expo-push';
import { logMessage } from '../message-log.service';

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
}

interface LocalizedMessage {
  title: string;
  body: string;
}

function buildMessage(data: AdaptiveTargetJobData): LocalizedMessage {
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

export async function processAdaptiveTargetJob(job: Job<AdaptiveTargetJobData>): Promise<void> {
  const data = job.data;
  const { userId, channels, chatId, pushTokens = [] } = data;

  const hasTelegram = channels.includes('telegram') && Boolean(chatId);
  const hasPush = channels.includes('push') && pushTokens.length > 0;

  if (!hasTelegram && !hasPush) {
    console.log(`[AdaptiveTarget] User ${userId}: no deliverable channels, skipping notification`);
    return;
  }

  const message = buildMessage(data);

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
          await sendTelegramMessage(chatId!, message.body);
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
          await sendExpoPush(pushTokens, message.title, message.body, {
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

async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.warn('[AdaptiveTarget] TELEGRAM_BOT_TOKEN not set, skipping Telegram delivery');
    return;
  }
  const bot = new Telegraf(botToken);
  await bot.telegram.sendMessage(chatId, text);
}
