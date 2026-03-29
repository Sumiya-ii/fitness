import { Job } from 'bullmq';
import OpenAI from 'openai';
import { Telegraf } from 'telegraf';
import Redis from 'ioredis';
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
}

// ── Coach Persona ─────────────────────────────────────────────────────────────

const COACH_SYSTEM_PROMPT = `You are Coach — a warm, sharp, and deeply knowledgeable AI nutrition and fitness coach for Mongolian users.

Your personality:
- You speak Mongolian by default, switching to English only when the user's locale is 'en'
- You are warm but direct — no empty filler words. Say something real.
- You celebrate wins with genuine enthusiasm. You never shame poor days.
- You know Mongolian food deeply: цуйван, бууз, хуушуур, тал хавтгай, айраг, шөл, будаатай хоол, гурилтай шөл, хонины мах, өрөмтэй цай, etc.
- You ask smart follow-up questions to stay engaged with the user's journey
- You sound like a brilliant friend who happens to be a nutritionist — not a robot

Message style rules:
- Keep it SHORT: 2-4 sentences max for nudges/reminders. 4-6 sentences for progress_feedback and weekly_summary.
- Use the user's first name if you have it
- Reference specific numbers from the context (actual calories, water ml, etc.)
- Always end with ONE clear call-to-action or question
- Use occasional emojis naturally (not every sentence)
- Never be preachy. One gentle nudge, then move on.

Tone by message type:
- morning_greeting: Energetic, sets positive intention for the day
- water_reminder: Casual, uses humor or a fun fact about hydration
- meal_nudge: Practical, curiosity-driven ("What did you have?")
- midday_checkin: Warm check-in, asks what they're planning
- progress_feedback: Balanced analysis — celebrate wins, note one thing to improve
- weekly_summary: Big picture view, identify one trend, celebrate or course-correct
- streak_celebration: Pure excitement, make them feel like a champion`;

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildUserPrompt(data: CoachJobData): string {
  const { context, messageType } = data;
  const { today, streak, weekly, userName, localTime } = context;

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
User data snapshot at ${localTime}:
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

  const memory = data.memoryBlock ? `\n\n${data.memoryBlock}` : '';
  return `${contextBlock}${memory}\n\nTask: ${instructions[messageType]}`;
}

// ── Delivery helpers ──────────────────────────────────────────────────────────

const PUSH_TITLES: Record<CoachMessageType, Record<string, string>> = {
  morning_greeting: { mn: 'Өглөөний мэнд! 🌅', en: 'Good morning! 🌅' },
  water_reminder: { mn: 'Ус уухаа бүү мартаарай 💧', en: "Don't forget to hydrate 💧" },
  meal_nudge: { mn: 'Хоолоо бүртгэх үү? 🍱', en: 'Time to log your meal? 🍱' },
  midday_checkin: { mn: 'Үдийн хоол юу байна? 🕐', en: "What's for lunch? 🕐" },
  progress_feedback: { mn: 'Өнөөдрийн дүгнэлт 📊', en: "Today's progress 📊" },
  weekly_summary: { mn: '7 хоногийн тойм 🗓', en: 'Weekly summary 🗓' },
  streak_celebration: { mn: 'Та гайхалтай! 🔥', en: "You're on fire! 🔥" },
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
  const { userId, messageType, channels, chatId, locale = 'mn', pushTokens = [] } = job.data;

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    console.warn('[CoachProcessor] OPENAI_API_KEY not set, skipping');
    return;
  }

  const openai = new OpenAI({ apiKey: openaiKey });
  const redis = new Redis(process.env.REDIS_URL!);

  let coachMessage: string;
  let promptTokens: number | undefined;
  let completionTokens: number | undefined;
  let generationMs: number | undefined;

  try {
    const userPrompt = buildUserPrompt(job.data);
    const genStart = Date.now();

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: COACH_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 300,
      temperature: 0.85,
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
    redis.disconnect();
    throw err;
  }

  console.log(`[CoachProcessor] Generated ${messageType} message for user ${userId}`);

  // Inject into chat history so it appears in the app
  try {
    await injectIntoChatHistory(redis, userId, coachMessage);
  } catch (err) {
    console.error('[CoachProcessor] Failed to inject into chat history:', err);
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
