import { Job } from 'bullmq';
import OpenAI from 'openai';
import { Telegraf } from 'telegraf';
import Redis from 'ioredis';
import { DateTime } from 'luxon';
import * as Sentry from '@sentry/node';
import { sendExpoPush } from '../expo-push';
import { logMessage } from '../message-log.service';

// ── Types (mirrors api/src/coach/coach.types.ts) ─────────────────────────────

type CoachMessageType =
  | 'morning_greeting'
  | 'water_reminder'
  | 'meal_nudge'
  | 'midday_checkin'
  | 'progress_feedback'
  | 'weekly_summary'
  | 'streak_celebration';

interface CoachContext {
  userName: string | null;
  locale: 'mn' | 'en';
  today: {
    mealsLogged: number;
    caloriesConsumed: number;
    caloriesTarget: number | null;
    proteinConsumed: number;
    proteinTarget: number | null;
    carbsConsumed: number;
    fatConsumed: number;
    waterMl: number;
    waterTarget: number;
    mealTypes: string[];
  };
  streak: { mealLoggingDays: number; waterGoalDays: number };
  weekly: {
    avgDailyCalories: number;
    avgMealsPerDay: number;
    daysWithWaterGoalMet: number;
    totalDays: number;
  };
  messageType: CoachMessageType;
  localTime: string;
}

interface CoachJobData {
  userId: string;
  messageType: CoachMessageType;
  channels: string[];
  chatId?: string;
  locale?: string;
  pushTokens?: string[];
  context: CoachContext;
  memoryBlock?: string;
  timezone?: string;
}

// ── Time window validation ───────────────────────────────────────────────────

const MESSAGE_TIME_WINDOWS: Record<CoachMessageType, Array<[number, number]>> = {
  morning_greeting: [[7 * 60 + 30, 9 * 60 + 30]],
  water_reminder: [
    [10 * 60, 12 * 60],
    [15 * 60, 19 * 60],
  ],
  meal_nudge: [
    [11 * 60, 13 * 60],
    [18 * 60, 20 * 60],
  ],
  midday_checkin: [[12 * 60, 14 * 60]],
  progress_feedback: [[20 * 60, 22 * 60]],
  weekly_summary: [[9 * 60, 11 * 60]],
  streak_celebration: [[9 * 60, 11 * 60]],
};

/**
 * Check whether the message type is still appropriate for the user's current local time.
 * Returns false if the job is stale (e.g., morning_greeting job processed in the afternoon).
 */
export function isMessageTypeValidForTime(
  messageType: CoachMessageType,
  currentLocalTime: string,
): boolean {
  const [h, m] = currentLocalTime.split(':').map(Number);
  const totalMin = (h ?? 0) * 60 + (m ?? 0);
  const windows = MESSAGE_TIME_WINDOWS[messageType];
  return windows.some(([start, end]) => totalMin >= start && totalMin < end);
}

/**
 * Get the time-of-day period label for AI prompt context.
 */
export function getTimePeriod(localTime: string): string {
  const [h] = localTime.split(':').map(Number);
  const hour = h ?? 0;
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

// ── Coach Persona ─────────────────────────────────────────────────────────────

const COACH_SYSTEM_PROMPT = `You are Coach — a warm, sharp, and deeply knowledgeable AI nutrition and fitness coach for Mongolian users.

If Coach were a person at a party: the friend who notices you grabbed a second plate and says "Зүгээр — чи өнөөдөр хүрсэн" instead of giving you a look. They remember what you ate last Tuesday. They get genuinely excited when you hit a protein goal.

Your personality:
- You speak Mongolian by default, switching to English only when the user's locale is 'en'
- You are warm but direct — no empty filler words. Say something real.
- You celebrate wins with genuine enthusiasm and SPECIFIC numbers. You never shame poor days.
- You know Mongolian food deeply: бууз (comfort, family), цуйван (everyday fuel), хуушуур (Наадам season), шөл (winter warmth), будаатай хоол (weekday staple), хонины мах (protein king), өрөмтэй цай, тал хавтгай, айраг (summer tradition)
- You make food references that feel like home, not tourism: "Ээжийн бууз нэг бүр 180 ккал орчим. Тийм, бид тоолсон."
- You ask smart follow-up questions to stay engaged with the user's journey
- You sound like a brilliant friend who happens to be a nutritionist — not a robot or a textbook

Message style rules:
- Keep it SHORT: 2-4 sentences max for nudges/reminders. 4-6 sentences for progress_feedback and weekly_summary.
- Use the user's first name if you have it
- Reference SPECIFIC numbers from the context (actual calories, water ml, protein g — not vague praise)
- Always end with ONE clear call-to-action or question
- Use occasional emojis naturally (not every sentence, not more than 2 per message)
- Never be preachy. One gentle nudge, then move on.
- Make tracking feel like a game, not homework

Tone by message type — you MUST match the requested message type exactly. Never use morning greetings for non-morning types:
- morning_greeting: Energetic, forward-looking ("What's the plan today?"), sets positive intention. Only use "good morning" / "өглөөний мэнд" language here.
- water_reminder: Casual, uses humor or a fun fact. "Усны хэрэглээ чинь чамайг дуудаж байна" > "Ус уугаарай"
- meal_nudge: Curiosity-driven, never guilty. "Юу идсэн бэ?" > "Хоол бүртгэхээ мартсан уу?"
- midday_checkin: Warm, asks what they're planning for lunch/afternoon. No morning language.
- progress_feedback: Balanced — celebrate ONE specific win with a number, note ONE practical improvement for tomorrow. Be honest but kind. This is an evening message.
- weekly_summary: Big picture, identify the #1 trend (good or needs work), end with one concrete action
- streak_celebration: Pure excitement, make them feel like a champion. Reference how rare their consistency is.`;

// ── Prompt builder ────────────────────────────────────────────────────────────

export function buildUserPrompt(data: CoachJobData, currentLocalTime?: string): string {
  const { context, messageType } = data;
  const { today, streak, weekly, userName } = context;
  // Use fresh local time if available (recalculated at processing time), fall back to enqueue time
  const localTime = currentLocalTime ?? context.localTime;
  const timePeriod = getTimePeriod(localTime);

  const name = userName ? `, ${userName}` : '';
  const calorieStatus = today.caloriesTarget
    ? `${today.caloriesConsumed}/${today.caloriesTarget} kcal (${Math.round((today.caloriesConsumed / today.caloriesTarget) * 100)}% of goal)`
    : `${today.caloriesConsumed} kcal logged`;
  const waterStatus = `${today.waterMl}/${today.waterTarget} ml`;
  const mealStatus =
    today.mealsLogged === 0
      ? 'no meals logged yet'
      : `${today.mealsLogged} meal(s) logged (${today.mealTypes.join(', ')})`;
  const proteinStatus = today.proteinTarget
    ? `${today.proteinConsumed}g / ${today.proteinTarget}g protein`
    : `${today.proteinConsumed}g protein`;

  const streakText =
    streak.mealLoggingDays > 0
      ? `${streak.mealLoggingDays}-day meal logging streak`
      : 'no current streak';

  const contextBlock = `
Message type: ${messageType}
Current time: ${localTime} (${timePeriod}) — user's local time
- Name: ${userName ?? 'unknown'}
- Today: ${calorieStatus}, ${waterStatus} water, ${mealStatus}, ${proteinStatus}
- Streak: ${streakText}, ${streak.waterGoalDays} days hitting water goal
- Weekly (last 7 days): avg ${weekly.avgDailyCalories} kcal/day, avg ${weekly.avgMealsPerDay} meals/day, ${weekly.daysWithWaterGoalMet}/${weekly.totalDays} days met water goal
`.trim();

  const instructions: Record<CoachMessageType, string> = {
    morning_greeting: `Send a warm morning greeting${name}. Acknowledge the day and set a positive nutrition intention. Reference their data if meaningful.`,
    water_reminder: `They've only had ${today.waterMl}ml water so far today. Send a fun, light reminder to drink water. Maybe a quick hydration fact. Don't lecture.`,
    meal_nudge: `They've logged ${today.mealsLogged} meal(s) today. Nudge them to log their next meal. Ask what they're eating — be curious, not pushy.`,
    midday_checkin: `It's midday and they've logged ${today.mealsLogged} meal(s). Do a warm check-in. Ask what they're having for lunch or what their plan is.`,
    progress_feedback: `Evening review. Give honest, encouraging feedback on today: ${calorieStatus}, ${waterStatus}, ${mealStatus}. Celebrate one thing they did well. Note one thing to improve tomorrow. Be specific.`,
    weekly_summary: `Weekly summary. Avg ${weekly.avgDailyCalories} kcal/day, avg ${weekly.avgMealsPerDay} meals/day, hit water goal ${weekly.daysWithWaterGoalMet}/${weekly.totalDays} days. Identify the #1 trend (good or needs work). End with one specific action for next week.`,
    streak_celebration: `They've been logging meals for ${streak.mealLoggingDays} days straight! Celebrate their consistency with real enthusiasm. Make them feel like a champion. Mention one benefit of consistent logging.`,
  };

  const timeConstraint =
    messageType === 'morning_greeting'
      ? ''
      : ` CRITICAL: It is currently ${timePeriod} (${localTime}). Do NOT use morning greetings, "good morning", or breakfast references. Match your tone to the ${timePeriod}.`;

  const memory = data.memoryBlock ? `\n\n${data.memoryBlock}` : '';
  return `${contextBlock}${memory}\n\nTask: ${instructions[messageType]}${timeConstraint}`;
}

// ── Delivery helpers ──────────────────────────────────────────────────────────

const PUSH_TITLES: Record<CoachMessageType, Record<string, string>> = {
  morning_greeting: { mn: 'Өглөөний мэнд! 🌅', en: 'Good morning! 🌅' },
  water_reminder: { mn: 'Ус уух цаг боллоо 💧', en: 'Your body wants water 💧' },
  meal_nudge: { mn: 'Юу идсэн бэ? 🍱', en: 'What did you eat? 🍱' },
  midday_checkin: { mn: 'Үдийн хоолонд юу байна? 🕐', en: "What's the lunch plan? 🕐" },
  progress_feedback: { mn: 'Өнөөдрийн дүгнэлт 📊', en: "Today's wrap-up 📊" },
  weekly_summary: { mn: '7 хоногийн тойм 🗓', en: 'Your week in review 🗓' },
  streak_celebration: { mn: 'Гайхалтай! 🔥', en: "You're on fire! 🔥" },
};

async function sendTelegram(chatId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn('[CoachProcessor] TELEGRAM_BOT_TOKEN not set, skipping Telegram delivery');
    return;
  }
  const bot = new Telegraf(token);
  try {
    // Try Markdown first for nicer formatting
    await bot.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  } catch (err) {
    // If Markdown parsing fails (unmatched *, _, [, etc. from AI), send as plain text
    console.warn(
      '[CoachProcessor] Markdown send failed, retrying as plain text:',
      err instanceof Error ? err.message : err,
    );
    await bot.telegram.sendMessage(chatId, text);
  }
}

/**
 * Inject the coach message into the user's chat history in Redis
 * so it surfaces in the CoachChatScreen in the mobile app.
 */
async function injectIntoChatHistory(redis: Redis, userId: string, message: string): Promise<void> {
  const historyKey = `chat:history:${userId}`;
  const MAX_HISTORY = 40;
  const HISTORY_TTL = 60 * 60 * 24 * 7;

  const raw = await redis.get(historyKey);
  let history: Array<{ role: string; content: string; timestamp: string }> = [];
  if (raw) {
    try {
      history = JSON.parse(raw);
    } catch {
      history = [];
    }
  }

  history.push({
    role: 'assistant',
    content: message,
    timestamp: new Date().toISOString(),
  });

  if (history.length > MAX_HISTORY) {
    history = history.slice(-MAX_HISTORY);
  }

  await redis.setex(historyKey, HISTORY_TTL, JSON.stringify(history));
}

// ── Main processor ────────────────────────────────────────────────────────────

export async function processCoachMessageJob(job: Job<CoachJobData>): Promise<void> {
  const {
    userId,
    messageType,
    channels,
    chatId,
    locale = 'mn',
    pushTokens = [],
    timezone,
  } = job.data;

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    console.warn('[CoachProcessor] OPENAI_API_KEY not set, skipping');
    return;
  }

  // ── Staleness guard: reject jobs whose message type no longer fits the time ──
  let currentLocalTime: string | undefined;
  if (timezone) {
    const now = DateTime.now().setZone(timezone);
    currentLocalTime = now.toFormat('HH:mm');
    if (!isMessageTypeValidForTime(messageType, currentLocalTime)) {
      console.warn(
        `[CoachProcessor] Stale job: ${messageType} no longer valid at ${currentLocalTime} (${timezone}) for user ${userId}, skipping`,
      );
      return;
    }
  }

  const openai = new OpenAI({ apiKey: openaiKey });
  const redis = new Redis(process.env.REDIS_URL!);

  let coachMessage: string;
  let promptTokens: number | undefined;
  let completionTokens: number | undefined;
  let generationMs: number | undefined;

  try {
    const userPrompt = buildUserPrompt(job.data, currentLocalTime);
    const genStart = Date.now();

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: COACH_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 300,
      temperature: 0.75,
    });

    generationMs = Date.now() - genStart;
    promptTokens = response.usage?.prompt_tokens;
    completionTokens = response.usage?.completion_tokens;

    coachMessage =
      response.choices[0]?.message?.content?.trim() ??
      (locale === 'mn'
        ? 'Сайн уу! Өнөөдрийн хоолоо бүртгэхээ бүү мартаарай. 💪'
        : "Hey! Don't forget to log your meals today. 💪");
  } catch (err) {
    console.error('[CoachProcessor] OpenAI error:', err);
    Sentry.captureException(err, {
      tags: { processor: 'coach', stage: 'openai_generation' },
      extra: { userId, messageType },
    });
    redis.disconnect();
    throw err;
  }

  console.log(`[CoachProcessor] Generated ${messageType} message for user ${userId}`);

  // Inject into chat history so it appears in the app
  try {
    await injectIntoChatHistory(redis, userId, coachMessage);
  } catch (err) {
    console.error('[CoachProcessor] Failed to inject into chat history:', err);
    Sentry.captureException(err, {
      tags: { processor: 'coach', stage: 'chat_history_inject' },
      extra: { userId },
    });
  } finally {
    redis.disconnect();
  }

  const hasTelegram = channels.includes('telegram') && Boolean(chatId);
  const hasPush = channels.includes('push') && pushTokens.length > 0;

  if (!hasTelegram && !hasPush) {
    console.log(`[CoachProcessor] No deliverable channel for user ${userId}`);
    return;
  }

  const lang = locale === 'en' ? 'en' : 'mn';
  const title = PUSH_TITLES[messageType][lang] ?? PUSH_TITLES[messageType]['mn']!;

  const sharedLogFields = {
    userId,
    messageType,
    content: coachMessage,
    aiModel: 'gpt-4o',
    promptTokens,
    completionTokens,
    generationMs,
    jobId: job.id,
  };

  const deliveries: Promise<void>[] = [];

  if (hasTelegram) {
    deliveries.push(
      (async () => {
        const start = Date.now();
        try {
          await sendTelegram(chatId!, coachMessage);
          await logMessage({
            ...sharedLogFields,
            channel: 'telegram',
            status: 'sent',
            deliveryMs: Date.now() - start,
          });
        } catch (err) {
          console.error(`[CoachProcessor] Telegram delivery error for user ${userId}:`, err);
          Sentry.captureException(err, {
            tags: { processor: 'coach', stage: 'telegram_delivery' },
            extra: { userId, messageType },
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
          await sendExpoPush(pushTokens, title, coachMessage, {
            type: 'coach_message',
            screen: 'CoachChat',
          });
          await logMessage({
            ...sharedLogFields,
            channel: 'push',
            status: 'sent',
            deliveryMs: Date.now() - start,
          });
        } catch (err) {
          console.error(`[CoachProcessor] Push delivery error for user ${userId}:`, err);
          Sentry.captureException(err, {
            tags: { processor: 'coach', stage: 'push_delivery' },
            extra: { userId, messageType },
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
    `[CoachProcessor] Sent ${messageType} to user ${userId} (telegram=${hasTelegram}, push=${hasPush})`,
  );
}
