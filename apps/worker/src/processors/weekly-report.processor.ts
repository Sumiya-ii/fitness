import { Job } from 'bullmq';
import OpenAI from 'openai';
import { Telegraf } from 'telegraf';
import Redis from 'ioredis';
import { sendExpoPush } from '../expo-push';

// ── Types (mirrors api/src/weekly-report/weekly-report.service.ts) ────────────

interface WeeklyReportData {
  weekStart: string;
  weekEnd: string;
  daysLogged: number;
  averageCalories: number;
  averageProtein: number;
  calorieTarget: number | null;
  proteinTarget: number | null;
  adherenceScore: number;
  weightDelta: number | null;
  endOfWeekStreak: number;
}

interface WeeklyReportJobData {
  userId: string;
  channels: string[];
  chatId?: string;
  locale?: string;
  pushTokens?: string[];
  report: WeeklyReportData;
  userName: string | null;
}

// ── System prompt ─────────────────────────────────────────────────────────────

const WEEKLY_REPORT_SYSTEM_PROMPT = `You are Coach — a warm, insightful AI nutrition coach for Mongolian users.

Every Monday morning you send users a personalized weekly performance report.

Your personality:
- Speak Mongolian by default; use English only when locale is 'en'
- Direct and data-driven but genuinely warm — this is a mentor-style debrief, not a report card
- Celebrate genuine wins with specific numbers; never shame poor weeks
- You know Mongolian food: цуйван, бууз, хуушуур, тал хавтгай, хонины мах, etc.

Report structure (4–6 sentences, no headers or bullet points):
1. Opening: greet by name if available, briefly acknowledge last week
2. Win: highlight the #1 thing they did well (be specific with numbers)
3. Focus: identify ONE clear area to improve this week (practical, not preachy)
4. Close: short, energizing encouragement for the week ahead

Rules:
- Always reference real numbers from the data (daysLogged/7, averageCalories, averageProtein, weightDelta)
- If they hit their calorie target most days, celebrate it; if they didn't log often, note it gently
- Weight loss: celebrate; weight gain: frame neutrally (muscle, data variability)
- No weight data? Skip weight entirely
- End with a concrete, single action for this week
- Keep it under 120 words total`;

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildPrompt(data: WeeklyReportJobData): string {
  const { report, userName, locale = 'mn' } = data;
  const name = userName ?? (locale === 'mn' ? 'та' : 'you');

  const calorieStatus = report.calorieTarget
    ? `avg ${report.averageCalories} kcal/day (target: ${report.calorieTarget} kcal)`
    : `avg ${report.averageCalories} kcal/day`;

  const proteinStatus = report.proteinTarget
    ? `avg protein ${report.averageProtein}g/day (target: ${report.proteinTarget}g)`
    : `avg protein ${report.averageProtein}g/day`;

  const weightStatus =
    report.weightDelta !== null
      ? `weight change: ${report.weightDelta > 0 ? '+' : ''}${report.weightDelta} kg`
      : 'no weight data this week';

  const streakNote =
    report.endOfWeekStreak >= 3
      ? `finished the week with a ${report.endOfWeekStreak}-day logging streak`
      : `end-of-week streak: ${report.endOfWeekStreak} consecutive days`;

  return `
Weekly report for ${name} (locale: ${locale}):
- Logged: ${report.daysLogged}/7 days (adherence ${report.adherenceScore}%)
- ${calorieStatus}
- ${proteinStatus}
- ${weightStatus}
- ${streakNote}

Write the weekly performance summary following the system prompt structure.
`.trim();
}

// ── Delivery helpers ──────────────────────────────────────────────────────────

async function sendTelegram(chatId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn('[WeeklyReport] TELEGRAM_BOT_TOKEN not set, skipping Telegram delivery');
    return;
  }
  const bot = new Telegraf(token);
  await bot.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown' });
}

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

  history.push({ role: 'assistant', content: message, timestamp: new Date().toISOString() });
  if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);

  await redis.setex(historyKey, HISTORY_TTL, JSON.stringify(history));
}

// ── Main processor ────────────────────────────────────────────────────────────

export async function processWeeklyReportJob(job: Job<WeeklyReportJobData>): Promise<void> {
  const { userId, channels, chatId, locale = 'mn', pushTokens = [] } = job.data;

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    console.warn('[WeeklyReport] OPENAI_API_KEY not set, skipping');
    return;
  }

  const openai = new OpenAI({ apiKey: openaiKey });
  const redis = new Redis(process.env.REDIS_URL!);

  let reportMessage: string;
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: WEEKLY_REPORT_SYSTEM_PROMPT },
        { role: 'user', content: buildPrompt(job.data) },
      ],
      max_tokens: 400,
      temperature: 0.75,
    });

    const fallback =
      locale === 'mn'
        ? 'Өнгөрсөн долоо хоногийн ажлыг нь танд мэдэгдье. Энэ долоо хоногт сайн үргэлжлүүлэцгээе! 💪'
        : "Here's your weekly report. Keep up the great work this week! 💪";

    reportMessage = response.choices[0]?.message?.content?.trim() ?? fallback;
  } catch (err) {
    console.error('[WeeklyReport] OpenAI error:', err);
    redis.disconnect();
    throw err;
  }

  console.log(`[WeeklyReport] Generated report for user ${userId}`);

  try {
    await injectIntoChatHistory(redis, userId, reportMessage);
  } catch (err) {
    console.error('[WeeklyReport] Failed to inject into chat history:', err);
  } finally {
    redis.disconnect();
  }

  const hasTelegram = channels.includes('telegram') && Boolean(chatId);
  const hasPush = channels.includes('push') && pushTokens.length > 0;

  if (!hasTelegram && !hasPush) {
    console.log(`[WeeklyReport] No deliverable channel for user ${userId}`);
    return;
  }

  const title = locale === 'en' ? 'Your weekly report 📊' : '7 хоногийн тайлан 📊';

  const results = await Promise.allSettled([
    hasTelegram ? sendTelegram(chatId!, reportMessage) : Promise.resolve(),
    hasPush
      ? sendExpoPush(pushTokens, title, reportMessage, {
          type: 'weekly_report',
          screen: 'CoachChat',
        })
      : Promise.resolve(),
  ]);

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error(`[WeeklyReport] Delivery error for user ${userId}:`, result.reason);
    }
  }

  console.log(`[WeeklyReport] Sent to user ${userId} (telegram=${hasTelegram}, push=${hasPush})`);
}
