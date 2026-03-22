import { Job } from 'bullmq';
import { Telegraf } from 'telegraf';
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
        title: 'Calorie target adjusted 📈',
        body: `You've been losing weight faster than planned, so we've ${directionEn} your daily target by ${kcal} kcal to ${data.newCalorieTarget} kcal. Keep it sustainable!`,
      };
    }
    return {
      title: 'Calorie target adjusted 🔄',
      body: `Progress has been slower than expected, so we've ${directionEn} your daily target by ${kcal} kcal to ${data.newCalorieTarget} kcal. Stay consistent!`,
    };
  }

  // Default: Mongolian
  if (data.reason === 'too_fast') {
    return {
      title: 'Калорийн зорилт өөрчлөгдлөө 📈',
      body: `Жин хэт хурдан буурч байна. Өдрийн зорилтод ${kcal} ккал ${direction} — одоо ${data.newCalorieTarget} ккал боллоо. Тогтвортой явцыг хадгал!`,
    };
  }
  return {
    title: 'Калорийн зорилт өөрчлөгдлөө 🔄',
    body: `Ахиц удаашилсан байна. Өдрийн зорилтоос ${kcal} ккал ${direction} — одоо ${data.newCalorieTarget} ккал боллоо. Тогтмол байгаарай!`,
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
