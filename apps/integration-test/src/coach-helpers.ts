import OpenAI from 'openai';

// ── Types (mirrors coach.processor.ts) ───────────────────────────────────────

export type CoachMessageType =
  | 'morning_greeting'
  | 'water_reminder'
  | 'meal_nudge'
  | 'midday_checkin'
  | 'progress_feedback'
  | 'weekly_summary'
  | 'streak_celebration';

export interface CoachContext {
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

export interface CoachMessageResult {
  message: string;
  promptTokens?: number;
  completionTokens?: number;
}

// ── Prompts (mirrors coach.processor.ts exactly) ─────────────────────────────

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

function buildUserPrompt(context: CoachContext, memoryBlock?: string): string {
  const { today, streak, weekly, userName, localTime, messageType } = context;
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

  const memory = memoryBlock ? `\n\n${memoryBlock}` : '';
  return `${contextBlock}${memory}\n\nTask: ${instructions[messageType]}`;
}

// ── Main function ────────────────────────────────────────────────────────────

/**
 * Generate a coach message using GPT-4o.
 * Mirrors the generation logic in coach.processor.ts (no delivery).
 */
export async function generateCoachMessage(
  context: CoachContext,
  memoryBlock?: string,
): Promise<CoachMessageResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const openai = new OpenAI({ apiKey });
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: COACH_SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(context, memoryBlock) },
    ],
    max_tokens: 300,
    temperature: 0.85,
  });

  return {
    message: response.choices[0]?.message?.content?.trim() ?? '',
    promptTokens: response.usage?.prompt_tokens,
    completionTokens: response.usage?.completion_tokens,
  };
}

// ── Weekly report types + generation ─────────────────────────────────────────

export interface WeeklyReportData {
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

function buildWeeklyReportPrompt(
  report: WeeklyReportData,
  userName: string | null,
  locale: string,
  memoryBlock?: string,
): string {
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

  const memory = memoryBlock ? `\n\n${memoryBlock}` : '';

  return `
Weekly report for ${name} (locale: ${locale}):
- Logged: ${report.daysLogged}/7 days (adherence ${report.adherenceScore}%)
- ${calorieStatus}
- ${proteinStatus}
- ${weightStatus}
- ${streakNote}${memory}

Write the weekly performance summary following the system prompt structure.
`.trim();
}

/**
 * Generate a weekly report using GPT-4o.
 * Mirrors weekly-report.processor.ts generation (no delivery).
 */
export async function generateWeeklyReport(
  report: WeeklyReportData,
  userName: string | null,
  locale = 'mn',
  memoryBlock?: string,
): Promise<CoachMessageResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const openai = new OpenAI({ apiKey });
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: WEEKLY_REPORT_SYSTEM_PROMPT },
      { role: 'user', content: buildWeeklyReportPrompt(report, userName, locale, memoryBlock) },
    ],
    max_tokens: 400,
    temperature: 0.75,
  });

  return {
    message: response.choices[0]?.message?.content?.trim() ?? '',
    promptTokens: response.usage?.prompt_tokens,
    completionTokens: response.usage?.completion_tokens,
  };
}

// ── Coach memory types + generation ──────────────────────────────────────────

export interface MemorySummaries {
  foods: string;
  patterns: string;
  goals: string;
  preferences: string;
}

/**
 * Generate coach memory summaries from a pre-built data block.
 * Mirrors coach-memory.processor.ts generateSummaries() (no DB).
 */
export async function generateMemorySummaries(dataBlock: string): Promise<MemorySummaries> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const openai = new OpenAI({ apiKey });
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You generate concise coach memory summaries from user nutrition data.
Each summary must be 1–3 sentences, specific (use real numbers/food names), and written in English.
Mention Mongolian food names where they appear (e.g., бууз, цуйван, хуушуур).
Return ONLY valid JSON with exactly these 4 keys: foods, patterns, goals, preferences.`,
      },
      {
        role: 'user',
        content: `Generate memory summaries for this user based on their last 30 days of data:\n\n${dataBlock}\n\nReturn JSON: {"foods":"...","patterns":"...","goals":"...","preferences":"..."}`,
      },
    ],
    max_tokens: 400,
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  const raw = response.choices[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(raw) as Partial<MemorySummaries>;

  return {
    foods: parsed.foods ?? 'No food pattern data available yet.',
    patterns: parsed.patterns ?? 'No pattern data available yet.',
    goals: parsed.goals ?? 'No goal data available yet.',
    preferences: parsed.preferences ?? 'No preference data available yet.',
  };
}
