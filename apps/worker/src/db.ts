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
         total_calories = $4,
         total_protein = $5,
         total_carbs = $6,
         total_fat = $7
     WHERE id = $1`,
    [
      draftId,
      data.transcription,
      JSON.stringify(data.parsedItems),
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
