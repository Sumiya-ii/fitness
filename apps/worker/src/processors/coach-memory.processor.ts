import { Job } from 'bullmq';
import OpenAI from 'openai';
import { Pool } from 'pg';

interface CoachMemoryJobData {
  userId: string;
  locale: string;
}

interface MemorySummaries {
  foods: string;
  patterns: string;
  goals: string;
  preferences: string;
}

// ── Data aggregation ──────────────────────────────────────────────────────────

async function aggregateUserData(pool: Pool, userId: string, since: Date): Promise<string> {
  const [topFoods, calsByDow, proteinByPeriod, daysLogged, mealTypes, weights, profile] =
    await Promise.all([
      // Top 10 foods by frequency
      pool.query<{ name: string; freq: string }>(
        `SELECT mli.snapshot_food_name AS name, COUNT(*)::text AS freq
         FROM meal_log_items mli
         JOIN meal_logs ml ON ml.id = mli.meal_log_id
         WHERE ml.user_id = $1 AND ml.logged_at >= $2
         GROUP BY mli.snapshot_food_name
         ORDER BY freq DESC
         LIMIT 10`,
        [userId, since],
      ),
      // Average calories by day of week (0=Sun, 1=Mon … 6=Sat)
      pool.query<{ dow: string; avg_cals: string }>(
        `SELECT EXTRACT(DOW FROM logged_at)::int::text AS dow,
                ROUND(AVG(total_calories))::text AS avg_cals
         FROM meal_logs
         WHERE user_id = $1 AND logged_at >= $2 AND total_calories IS NOT NULL
         GROUP BY EXTRACT(DOW FROM logged_at)
         ORDER BY dow`,
        [userId, since],
      ),
      // Average protein weekday vs weekend
      pool.query<{ period: string; avg_protein: string }>(
        `SELECT
           CASE WHEN EXTRACT(DOW FROM logged_at) IN (0,6) THEN 'weekend' ELSE 'weekday' END AS period,
           ROUND(AVG(total_protein)::numeric, 1)::text AS avg_protein
         FROM meal_logs
         WHERE user_id = $1 AND logged_at >= $2 AND total_protein IS NOT NULL
         GROUP BY period`,
        [userId, since],
      ),
      // Distinct days with at least one meal logged
      pool.query<{ days_logged: string }>(
        `SELECT COUNT(DISTINCT DATE(logged_at))::text AS days_logged
         FROM meal_logs
         WHERE user_id = $1 AND logged_at >= $2`,
        [userId, since],
      ),
      // Meal type distribution
      pool.query<{ meal_type: string; count: string }>(
        `SELECT meal_type, COUNT(*)::text AS count
         FROM meal_logs
         WHERE user_id = $1 AND logged_at >= $2 AND meal_type IS NOT NULL
         GROUP BY meal_type
         ORDER BY count DESC`,
        [userId, since],
      ),
      // Weight trend
      pool.query<{ weight_kg: string; logged_at: Date }>(
        `SELECT weight_kg::text, logged_at
         FROM weight_logs
         WHERE user_id = $1 AND logged_at >= $2
         ORDER BY logged_at`,
        [userId, since],
      ),
      // Profile + targets
      pool.query<{
        display_name: string | null;
        goal_weight_kg: string | null;
        calorie_target: string | null;
        protein_grams: string | null;
        goal_type: string | null;
      }>(
        `SELECT p.display_name, p.goal_weight_kg::text,
                t.calorie_target::text, t.protein_grams::text, t.goal_type
         FROM profiles p
         LEFT JOIN targets t ON t.user_id = p.user_id AND t.effective_to IS NULL
         WHERE p.user_id = $1
         ORDER BY t.effective_from DESC NULLS LAST
         LIMIT 1`,
        [userId],
      ),
    ]);

  const DOW_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const calsByDowText = calsByDow.rows
    .map((r) => `${DOW_NAMES[parseInt(r.dow)] ?? r.dow}: ${r.avg_cals} kcal`)
    .join(', ');

  const proteinText = proteinByPeriod.rows
    .map((r) => `${r.period} avg ${r.avg_protein}g protein`)
    .join(', ');

  const daysLoggedCount = daysLogged.rows[0]?.days_logged ?? '0';

  const mealTypeText = mealTypes.rows.map((r) => `${r.meal_type} (${r.count}x)`).join(', ');

  const weightFirst = weights.rows[0]?.weight_kg;
  const weightLast = weights.rows[weights.rows.length - 1]?.weight_kg;
  const weightText =
    weightFirst && weightLast
      ? `${weightFirst}kg → ${weightLast}kg (${(parseFloat(weightLast) - parseFloat(weightFirst)).toFixed(1)}kg change)`
      : 'no weight data';

  const p = profile.rows[0];
  const profileText = p
    ? [
        p.display_name ? `name: ${p.display_name}` : null,
        p.goal_type ? `goal: ${p.goal_type}` : null,
        p.goal_weight_kg ? `goal weight: ${p.goal_weight_kg}kg` : null,
        p.calorie_target ? `calorie target: ${p.calorie_target} kcal/day` : null,
        p.protein_grams ? `protein target: ${p.protein_grams}g/day` : null,
      ]
        .filter(Boolean)
        .join(', ')
    : 'no profile';

  const topFoodsText = topFoods.rows.map((r) => `${r.name} (${r.freq}x)`).join(', ');

  return [
    `Period: last 30 days`,
    `Days logged: ${daysLoggedCount}/30`,
    `Top foods: ${topFoodsText || 'none'}`,
    `Avg calories by day of week: ${calsByDowText || 'no data'}`,
    `Protein: ${proteinText || 'no data'}`,
    `Meal types: ${mealTypeText || 'none'}`,
    `Weight: ${weightText}`,
    `Profile: ${profileText}`,
  ].join('\n');
}

// ── GPT summary generation ────────────────────────────────────────────────────

async function generateSummaries(openai: OpenAI, dataBlock: string): Promise<MemorySummaries> {
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

// ── Main processor ────────────────────────────────────────────────────────────

export async function processCoachMemoryJob(job: Job<CoachMemoryJobData>): Promise<void> {
  const { userId } = job.data;

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    console.warn('[CoachMemory] OPENAI_API_KEY not set, skipping');
    return;
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.warn('[CoachMemory] DATABASE_URL not set, skipping');
    return;
  }

  const pool = new Pool({ connectionString: dbUrl });
  const openai = new OpenAI({ apiKey: openaiKey });

  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dataBlock = await aggregateUserData(pool, userId, since);

    const summaries = await generateSummaries(openai, dataBlock);

    // Upsert all 4 category summaries
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

    console.log(`[CoachMemory] Refreshed memory for user ${userId}`);
  } catch (err) {
    console.error(`[CoachMemory] Error for user ${userId}:`, err);
    throw err;
  } finally {
    await pool.end();
  }
}
