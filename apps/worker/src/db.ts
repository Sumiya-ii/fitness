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
  parsedItems: unknown[];
  mealType: string | null;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

export async function setVoiceDraftActive(draftId: string): Promise<void> {
  await getPool().query(`UPDATE voice_drafts SET status = 'active' WHERE id = $1`, [draftId]);
}

export async function setVoiceDraftCompleted(
  draftId: string,
  data: VoiceDraftUpdateCompleted,
): Promise<void> {
  await getPool().query(
    `UPDATE voice_drafts
     SET status = 'completed',
         transcription = $2,
         parsed_items = $3,
         meal_type = $4,
         total_calories = $5,
         total_protein = $6,
         total_carbs = $7,
         total_fat = $8
     WHERE id = $1`,
    [
      draftId,
      data.transcription,
      JSON.stringify(data.parsedItems),
      data.mealType,
      data.totalCalories,
      data.totalProtein,
      data.totalCarbs,
      data.totalFat,
    ],
  );
}

export async function setVoiceDraftFailed(draftId: string, errorMessage: string): Promise<void> {
  await getPool().query(
    `UPDATE voice_drafts SET status = 'failed', error_message = $2 WHERE id = $1`,
    [draftId, errorMessage],
  );
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
