import { Pool } from 'pg';
import { logger } from './logger';
import type { ParsedFoodItem } from './processors/photo.processor';

/**
 * Apply per-user calibration to a matched food item.
 *
 * Reads the user_food_calibrations table for (userId, matchedFoodId).
 * Only applies if sample_count >= 3 (below that the model is more trustworthy).
 * Multiplies all macro/calorie values by the median ratio.
 * Returns a new item object; never mutates the input.
 */
export async function applyUserCalibration(
  userId: string,
  item: ParsedFoodItem,
  pool: Pool,
): Promise<ParsedFoodItem> {
  if (!item.matchedFoodId) return item;

  let ratio: number | null = null;
  try {
    const result = await pool.query<{ median_ratio: string }>(
      `SELECT median_ratio
         FROM user_food_calibrations
        WHERE user_id = $1
          AND canonical_food_id = $2
          AND sample_count >= 3
        LIMIT 1`,
      [userId, item.matchedFoodId],
    );
    if (result.rows.length > 0) {
      ratio = Number(result.rows[0].median_ratio);
    }
  } catch (err) {
    logger.warn(
      {
        error: err instanceof Error ? err.message : String(err),
        userId,
        foodId: item.matchedFoodId,
      },
      '[Calibration] DB lookup failed, skipping calibration',
    );
    return item;
  }

  if (ratio === null || !isFinite(ratio) || ratio <= 0) return item;

  return {
    ...item,
    calories: item.calories * ratio,
    protein: item.protein * ratio,
    carbs: item.carbs * ratio,
    fat: item.fat * ratio,
    fiber: item.fiber * ratio,
    sugar: item.sugar * ratio,
    sodium: item.sodium * ratio,
    saturatedFat: item.saturatedFat * ratio,
  };
}
