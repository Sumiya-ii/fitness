import { Pool } from 'pg';

let _pool: Pool | undefined;

function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return _pool;
}

interface VoiceDraftUpdateCompleted {
  transcription: string;
  /**
   * Stored as a JSON envelope: { items, clarification? }.
   * The voice API surface unwraps `items` and optional `clarification`.
   * We store the envelope (not just the array) so a single Json column carries
   * both per-item parses and the optional follow-up payload without a migration.
   */
  parsedItems: unknown[];
  clarification?: unknown;
  mealType: string | null;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalSugar?: number;
  totalSodium?: number;
  totalSaturatedFat?: number;
  /**
   * Non-fatal warning surfaced alongside a completed draft (e.g. nutrition
   * parse failed but we still persisted the transcription).
   */
  errorMessage?: string;
}

export async function setVoiceDraftActive(draftId: string): Promise<void> {
  await getPool().query(`UPDATE voice_drafts SET status = 'active' WHERE id = $1`, [draftId]);
}

export async function setVoiceDraftCompleted(
  draftId: string,
  data: VoiceDraftUpdateCompleted,
): Promise<void> {
  // Persist both items and an optional clarification in the parsed_items JSON
  // column as { items, clarification? } so we don't need a new migration.
  const envelope = {
    items: data.parsedItems,
    ...(data.clarification ? { clarification: data.clarification } : {}),
  };
  await getPool().query(
    `UPDATE voice_drafts
     SET status = 'completed',
         transcription = $2,
         parsed_items = $3,
         meal_type = $4,
         total_calories = $5,
         total_protein = $6,
         total_carbs = $7,
         total_fat = $8,
         total_sugar = $9,
         total_sodium = $10,
         total_saturated_fat = $11,
         error_message = $12,
         updated_at = NOW()
     WHERE id = $1`,
    [
      draftId,
      data.transcription,
      JSON.stringify(envelope),
      data.mealType,
      data.totalCalories,
      data.totalProtein,
      data.totalCarbs,
      data.totalFat,
      data.totalSugar ?? null,
      data.totalSodium ?? null,
      data.totalSaturatedFat ?? null,
      data.errorMessage ?? null,
    ],
  );
}

export async function setVoiceDraftFailed(draftId: string, errorMessage: string): Promise<void> {
  await getPool().query(
    `UPDATE voice_drafts SET status = 'failed', error_message = $2, updated_at = NOW() WHERE id = $1`,
    [draftId, errorMessage],
  );
}

/**
 * Fetch this user's per-canonical-food calibration ratios for the given list.
 * Returns a Map keyed by canonicalFoodId. Only entries with ≥3 samples are
 * included — below that we trust the model. Bounded by app code to
 * [0.4, 2.5] on write, no need to clamp again here.
 */
export async function getCalibrationRatios(
  userId: string,
  canonicalFoodIds: string[],
): Promise<Map<string, number>> {
  const ids = Array.from(
    new Set(canonicalFoodIds.filter((s): s is string => typeof s === 'string')),
  );
  if (ids.length === 0) return new Map();
  const result = await getPool().query<{ canonical_food_id: string; median_ratio: string }>(
    `SELECT canonical_food_id, median_ratio
       FROM user_food_calibrations
      WHERE user_id = $1
        AND canonical_food_id = ANY($2::varchar[])
        AND sample_count >= 3`,
    [userId, ids],
  );
  return new Map(result.rows.map((r) => [r.canonical_food_id, Number(r.median_ratio)]));
}

/**
 * Mark push tokens as inactive after Expo returns DeviceNotRegistered.
 * Prevents repeated sends to stale/uninstalled devices.
 */
export async function deactivateExpiredTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  await getPool().query(
    `UPDATE device_tokens SET active = false, updated_at = NOW() WHERE token = ANY($1::text[])`,
    [tokens],
  );
}
