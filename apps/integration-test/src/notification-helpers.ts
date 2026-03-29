/**
 * Notification delivery helpers for integration tests.
 *
 * Tests real Telegram Bot API delivery, Expo Push API behavior,
 * and GPT-4o meal timing insight generation.
 */
import OpenAI from 'openai';

// ── Telegram delivery ──────────────────────────────────────────────────────────

export interface TelegramDeliveryResult {
  success: boolean;
  messageId?: number;
  error?: string;
}

/**
 * Send a message via Telegram Bot API (mirrors worker Telegraf usage).
 * Uses raw HTTP instead of Telegraf to avoid adding the dependency.
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
  parseMode?: 'Markdown' | 'HTML',
): Promise<TelegramDeliveryResult> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const body: Record<string, unknown> = { chat_id: chatId, text };
  if (parseMode) body.parse_mode = parseMode;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const json = (await response.json()) as {
    ok: boolean;
    result?: { message_id: number };
    description?: string;
  };

  if (json.ok) {
    return { success: true, messageId: json.result?.message_id };
  }
  return { success: false, error: json.description };
}

// ── Expo Push delivery ─────────────────────────────────────────────────────────

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

export interface ExpoPushResult {
  tickets: ExpoPushTicket[];
  deadTokens: string[];
}

/**
 * Send Expo push notifications (mirrors expo-push.ts).
 * Returns raw tickets + detected dead tokens.
 */
export async function sendExpoPush(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, unknown> = {},
): Promise<ExpoPushResult> {
  if (tokens.length === 0) return { tickets: [], deadTokens: [] };

  const messages = tokens.map((to) => ({
    to,
    title,
    body,
    sound: 'default' as const,
    data,
  }));

  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    throw new Error(`Expo Push API error: ${response.status}`);
  }

  const json = (await response.json()) as { data?: ExpoPushTicket[] };
  const tickets = json.data ?? [];

  const deadTokens = tokens.filter(
    (_, i) =>
      tickets[i]?.status === 'error' && tickets[i]?.details?.error === 'DeviceNotRegistered',
  );

  return { tickets, deadTokens };
}

// ── Meal timing insight generation (GPT-4o) ────────────────────────────────────

export interface MealTimingStat {
  mealType: string;
  avgHour: number;
  count: number;
}

export interface MealTimingInsights {
  weekStart: string;
  weekEnd: string;
  mealStats: MealTimingStat[];
  breakfastWeekdayRate: number;
  breakfastWeekendRate: number;
  lateNightEatingDays: number;
  avgEatingWindowMinutes: number | null;
  highlights: string[];
}

export interface MealTimingResult {
  message: string;
  promptTokens?: number;
  completionTokens?: number;
}

/** System prompt — mirrors meal-timing.processor.ts exactly */
const MEAL_TIMING_SYSTEM_PROMPT = `You are Coach — a warm, insightful AI nutrition coach for Mongolian users.

Every Monday morning you send users a personalized weekly meal-timing insight.

Your personality:
- Speak Mongolian by default; use English only when locale is 'en'
- Warm mentor-style — never shame, always supportive and curious
- Concrete and data-driven — mention specific times or percentages
- When relevant, reference Mongolian food culture (өглөөний цай is culturally important, шөл in winter makes sense late)

Message structure (3–5 sentences, no headers or bullet points):
1. Highlight the most notable meal-timing pattern with a SPECIFIC number
2. Explain briefly why it matters (energy levels, metabolism, sleep quality) — one sentence max
3. Give ONE practical, actionable tip for the coming week

Rules:
- Reference real numbers from the data (actual times, percentages)
- Priority order: breakfast skipping > late-night eating > eating window length
- If everything looks healthy, celebrate it warmly with the specific numbers
- Frame insights as discoveries, not corrections: "Сонирхолтой нь..." > "Та алдлаа..."
- Keep it under 100 words`;

function buildMealTimingPrompt(
  insights: MealTimingInsights,
  userName: string | null,
  locale: string,
): string {
  const name = userName ?? (locale === 'mn' ? 'та' : 'you');

  const mealStatsStr = insights.mealStats
    .map((s) => {
      const h = Math.floor(s.avgHour);
      const m = Math.round((s.avgHour - h) * 60);
      return `${s.mealType}: avg ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} (${s.count} logs)`;
    })
    .join(', ');

  const windowStr =
    insights.avgEatingWindowMinutes !== null
      ? `${Math.floor(insights.avgEatingWindowMinutes / 60)}h ${insights.avgEatingWindowMinutes % 60}m`
      : 'unknown';

  return `
Meal-timing insights for ${name} (locale: ${locale}), week ${insights.weekStart} – ${insights.weekEnd}:
- Breakfast on weekdays: ${insights.breakfastWeekdayRate}% of days
- Breakfast on weekends: ${insights.breakfastWeekendRate}% of days
- Late-night eating days (after 20:00): ${insights.lateNightEatingDays}/7 days
- Avg eating window: ${windowStr}
- Meal averages: ${mealStatsStr || 'no data'}
- Pre-computed highlights: ${insights.highlights.join(' | ')}

Write the meal-timing insight following the system prompt structure.
`.trim();
}

/**
 * Generate a meal timing insight using GPT-4o.
 * Mirrors meal-timing.processor.ts generation (no delivery).
 */
export async function generateMealTimingInsight(
  insights: MealTimingInsights,
  userName: string | null,
  locale = 'mn',
): Promise<MealTimingResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const openai = new OpenAI({ apiKey });
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: MEAL_TIMING_SYSTEM_PROMPT },
      { role: 'user', content: buildMealTimingPrompt(insights, userName, locale) },
    ],
    max_tokens: 300,
    temperature: 0.7,
  });

  return {
    message: response.choices[0]?.message?.content?.trim() ?? '',
    promptTokens: response.usage?.prompt_tokens,
    completionTokens: response.usage?.completion_tokens,
  };
}
