import { Job } from 'bullmq';
import OpenAI from 'openai';
import { Pool } from 'pg';
import * as Sentry from '@sentry/node';
import { logger } from '../logger';

interface CoachMemoryJobData {
  userId: string;
  locale: string;
}

// ── coach_memories schema: (id, user_id, category, summary, updated_at)
// Category values: 'foods' | 'patterns' | 'goals' | 'preferences'
// We keep the existing column shape (summary: text) and populate it with
// deterministic, derived sentences. GPT is only permitted to reformat the
// numbers already computed — it cannot add or fabricate any data.

interface DerivedFacts {
  // top 5 foods by frequency in last 14 days, directly from meal_log_items
  topFoods: Array<{ name: string; freq: number }>;
  // weight delta over last 14 days; null when < 2 entries
  weightTrendKg: number | null;
  // avg daily kcal vs calorie target over last 7 days; null when no target
  kcalAdherence: { avgKcal: number; target: number } | null;
  // distinct days logged in last 14 days (out of 14)
  streak: number;
  // explicit goal_type from profile, null if not set
  goalType: string | null;
}

// ── Data derivation ────────────────────────────────────────────────────────────

async function deriveFacts(pool: Pool, userId: string): Promise<DerivedFacts> {
  const now = new Date();
  const since14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const since7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [topFoodsResult, weightResult, kcalResult, streakResult, profileResult] = await Promise.all(
    [
      // Top 5 foods by frequency in last 14 days — direct count, no inference
      pool.query<{ name: string; freq: string }>(
        `SELECT mli.snapshot_food_name AS name, COUNT(*)::text AS freq
         FROM meal_log_items mli
         JOIN meal_logs ml ON ml.id = mli.meal_log_id
         WHERE ml.user_id = $1 AND ml.logged_at >= $2
           AND mli.snapshot_food_name IS NOT NULL
         GROUP BY mli.snapshot_food_name
         ORDER BY COUNT(*) DESC
         LIMIT 5`,
        [userId, since14],
      ),
      // Weight entries in last 14 days for delta derivation
      pool.query<{ weight_kg: string }>(
        `SELECT weight_kg::text
         FROM weight_logs
         WHERE user_id = $1 AND logged_at >= $2
         ORDER BY logged_at ASC`,
        [userId, since14],
      ),
      // Avg daily kcal last 7 days
      pool.query<{ avg_kcal: string }>(
        `SELECT ROUND(AVG(total_calories))::text AS avg_kcal
         FROM meal_logs
         WHERE user_id = $1 AND logged_at >= $2 AND total_calories IS NOT NULL`,
        [userId, since7],
      ),
      // Distinct days logged last 14 days
      pool.query<{ streak: string }>(
        `SELECT COUNT(DISTINCT DATE(logged_at))::text AS streak
         FROM meal_logs
         WHERE user_id = $1 AND logged_at >= $2`,
        [userId, since14],
      ),
      // goal_type + calorie_target — read directly from profile/targets, no inference
      pool.query<{ goal_type: string | null; calorie_target: string | null }>(
        `SELECT p.goal_type, t.calorie_target::text
         FROM profiles p
         LEFT JOIN targets t ON t.user_id = p.user_id AND t.effective_to IS NULL
         WHERE p.user_id = $1
         ORDER BY t.effective_from DESC NULLS LAST
         LIMIT 1`,
        [userId],
      ),
    ],
  );

  const topFoods = topFoodsResult.rows.map((r) => ({ name: r.name, freq: parseInt(r.freq, 10) }));

  let weightTrendKg: number | null = null;
  if (weightResult.rows.length >= 2) {
    const first = parseFloat(weightResult.rows[0]!.weight_kg);
    const last = parseFloat(weightResult.rows[weightResult.rows.length - 1]!.weight_kg);
    weightTrendKg = parseFloat((last - first).toFixed(1));
  }

  const profile = profileResult.rows[0];
  const rawAvgKcal = kcalResult.rows[0]?.avg_kcal;
  const calorieTarget = profile?.calorie_target ? parseFloat(profile.calorie_target) : null;
  const kcalAdherence =
    rawAvgKcal && calorieTarget && calorieTarget > 0
      ? { avgKcal: parseFloat(rawAvgKcal), target: calorieTarget }
      : null;

  const streak = parseInt(streakResult.rows[0]?.streak ?? '0', 10);
  const goalType = profile?.goal_type ?? null;

  return { topFoods, weightTrendKg, kcalAdherence, streak, goalType };
}

// ── Deterministic summary builders ────────────────────────────────────────────
// These produce the `summary` text for each category without any GPT inference.
// Numbers are derived directly from meal logs / weight logs / profile.

function buildFoodsSummary(facts: DerivedFacts, isMn: boolean): string {
  if (facts.topFoods.length === 0) {
    return isMn
      ? 'Сүүлийн 14 хоногт хоолны бүртгэл байхгүй байна.'
      : 'No food logs in the last 14 days.';
  }
  const list = facts.topFoods.map((f) => `${f.name} (${f.freq}x)`).join(', ');
  return isMn
    ? `Сүүлийн 14 хоногт хамгийн их идсэн хоолнууд: ${list}.`
    : `Most eaten foods in last 14 days: ${list}.`;
}

function buildPatternsSummary(facts: DerivedFacts, isMn: boolean): string {
  const parts: string[] = [];

  if (isMn) {
    parts.push(`14 хоногийн ${facts.streak} өдөр хоол бүртгэсэн.`);
    if (facts.kcalAdherence) {
      const diff = Math.round(facts.kcalAdherence.avgKcal - facts.kcalAdherence.target);
      const sign = diff >= 0 ? '+' : '';
      parts.push(
        `Сүүлийн 7 хоногт дундаж ${Math.round(facts.kcalAdherence.avgKcal)} ккал (зорилтоос ${sign}${diff} ккал).`,
      );
    }
  } else {
    parts.push(`Logged meals on ${facts.streak} of the last 14 days.`);
    if (facts.kcalAdherence) {
      const diff = Math.round(facts.kcalAdherence.avgKcal - facts.kcalAdherence.target);
      const sign = diff >= 0 ? '+' : '';
      parts.push(
        `Avg ${Math.round(facts.kcalAdherence.avgKcal)} kcal/day over last 7 days (${sign}${diff} vs target).`,
      );
    }
  }

  return (
    parts.join(' ') ||
    (isMn ? 'Загварын мэдээлэл байхгүй байна.' : 'No pattern data available yet.')
  );
}

function buildGoalsSummary(facts: DerivedFacts, isMn: boolean): string {
  const parts: string[] = [];

  if (facts.goalType) {
    parts.push(isMn ? `Зорилго: ${facts.goalType}.` : `Goal: ${facts.goalType}.`);
  }
  if (facts.weightTrendKg !== null) {
    const sign = facts.weightTrendKg >= 0 ? '+' : '';
    parts.push(
      isMn
        ? `Сүүлийн 14 хоногт жин ${sign}${facts.weightTrendKg} кг өөрчлөгдсөн.`
        : `Weight changed ${sign}${facts.weightTrendKg} kg over last 14 days.`,
    );
  }

  return (
    parts.join(' ') || (isMn ? 'Зорилгын мэдээлэл байхгүй байна.' : 'No goal data available yet.')
  );
}

function buildPreferencesSummary(facts: DerivedFacts, isMn: boolean): string {
  // Preferences are inferred from frequency only — no personality claims
  if (facts.topFoods.length === 0) {
    return isMn ? 'Сонголтын мэдээлэл байхгүй байна.' : 'No preference data available yet.';
  }
  const topName = facts.topFoods[0]!.name;
  return isMn
    ? `Хамгийн олон удаа идсэн хоол: ${topName} (${facts.topFoods[0]!.freq}x сүүлийн 14 хоногт).`
    : `Most frequently logged food: ${topName} (${facts.topFoods[0]!.freq}x in last 14 days).`;
}

// ── Optional GPT reformat (formatting only, no fabrication) ──────────────────
// GPT receives only the already-derived numbers and may only reformat them into
// a single 1–2 sentence summary per category. The constraint in the system
// prompt is intentional: "Only state what is in the data provided."

async function reformatWithGpt(
  openai: OpenAI,
  summaries: Record<string, string>,
  facts: DerivedFacts,
  isMn: boolean,
): Promise<Record<string, string>> {
  const lang = isMn ? 'Mongolian (Cyrillic)' : 'English';
  const evidenceBlock = JSON.stringify({
    topFoods: facts.topFoods,
    weightTrendKg: facts.weightTrendKg,
    kcalAdherence: facts.kcalAdherence,
    streak: facts.streak,
    goalType: facts.goalType,
  });

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You reformat nutrition coach memory summaries in ${lang}.
Only state what is in the data provided. Do not infer personality, preferences, or behavior beyond the numbers shown.
Do not add opinions, adjectives, or claims that are not directly derivable from the numbers.
Return ONLY valid JSON with exactly these 4 keys: foods, patterns, goals, preferences.
Each value must be 1–2 sentences maximum.`,
        },
        {
          role: 'user',
          content: `Reformat these summaries using ONLY the evidence data provided. Do not add anything not in the evidence.

Evidence (raw derived numbers):
${evidenceBlock}

Draft summaries to reformat:
${JSON.stringify(summaries)}

Return JSON: {"foods":"...","patterns":"...","goals":"...","preferences":"..."}`,
        },
      ],
      max_tokens: 300,
      temperature: 0.1, // low temperature: formatting only, not creative
      response_format: { type: 'json_object' },
    });

    const raw = response.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw) as Partial<Record<string, string>>;

    // Only accept GPT output if all 4 keys are present and non-empty; else use derived
    if (parsed.foods && parsed.patterns && parsed.goals && parsed.preferences) {
      return {
        foods: parsed.foods.slice(0, 500),
        patterns: parsed.patterns.slice(0, 500),
        goals: parsed.goals.slice(0, 500),
        preferences: parsed.preferences.slice(0, 500),
      };
    }
  } catch (err) {
    logger.warn(
      { error: err instanceof Error ? err.message : String(err) },
      '[CoachMemory] GPT reformat failed, using derived summaries',
    );
  }

  return summaries;
}

// ── Main processor ────────────────────────────────────────────────────────────

export async function processCoachMemoryJob(job: Job<CoachMemoryJobData>): Promise<void> {
  const { userId, locale = 'mn' } = job.data;

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    logger.warn('[CoachMemory] OPENAI_API_KEY not set, skipping');
    return;
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    logger.warn('[CoachMemory] DATABASE_URL not set, skipping');
    return;
  }

  const pool = new Pool({ connectionString: dbUrl });
  const openai = new OpenAI({ apiKey: openaiKey, timeout: 60_000 });
  const isMn = locale !== 'en';

  try {
    // Step 1: derive verifiable facts directly from DB (no GPT)
    const facts = await deriveFacts(pool, userId);

    const hasAnyData =
      facts.topFoods.length > 0 ||
      facts.weightTrendKg !== null ||
      facts.kcalAdherence !== null ||
      facts.streak > 0 ||
      facts.goalType !== null;

    if (!hasAnyData) {
      logger.info({ userId }, '[CoachMemory] No data yet for user, skipping memory update');
      return;
    }

    // Step 2: build deterministic summaries from derived numbers
    let summaries: Record<string, string> = {
      foods: buildFoodsSummary(facts, isMn),
      patterns: buildPatternsSummary(facts, isMn),
      goals: buildGoalsSummary(facts, isMn),
      preferences: buildPreferencesSummary(facts, isMn),
    };

    // Step 3: optionally reformat with GPT (formatting only, never fabrication)
    summaries = await reformatWithGpt(openai, summaries, facts, isMn);

    // Step 4: upsert into coach_memories (existing schema: category + summary)
    const categories = ['foods', 'patterns', 'goals', 'preferences'] as const;
    await Promise.all(
      categories.map((category) =>
        pool.query(
          `INSERT INTO coach_memories (id, user_id, category, summary, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, NOW())
           ON CONFLICT (user_id, category)
           DO UPDATE SET summary = EXCLUDED.summary, updated_at = NOW()`,
          [userId, category, summaries[category]],
        ),
      ),
    );

    logger.info(
      { userId, streak: facts.streak, hasWeight: facts.weightTrendKg !== null },
      '[CoachMemory] Refreshed memory',
    );
  } catch (err) {
    logger.error(
      { userId, error: err instanceof Error ? err.message : String(err) },
      '[CoachMemory] Job failed',
    );
    Sentry.captureException(err, {
      tags: { processor: 'coach_memory' },
      extra: { userId },
    });
    throw err;
  } finally {
    await pool.end();
  }
}
