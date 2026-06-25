import { Pool } from 'pg';
import { logger } from './logger';

export interface VerifiedFoodRow {
  id: string;
  nameMn: string;
  nameEn: string;
  perHundredG: {
    kcal: number;
    p: number;
    c: number;
    f: number;
    fi: number;
    su: number;
    so: number;
    sf: number;
  };
}

/** Normalize a string for matching: lowercase, collapse spaces, strip diacritics. */
export function normalizeName(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

/** Split into tokens (words ≥ 2 chars). */
function tokenize(s: string): Set<string> {
  return new Set(
    normalizeName(s)
      .split(' ')
      .filter((t) => t.length >= 2),
  );
}

/**
 * Token-overlap Jaccard score between two strings.
 * Returns 0–1. Uses |intersection| / |union|.
 */
export function tokenOverlap(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.size === 0 && tb.size === 0) return 1;
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  for (const t of ta) {
    if (tb.has(t)) intersection++;
  }
  return intersection / (ta.size + tb.size - intersection);
}

type FoodRow = {
  id: string;
  normalized_name: string;
  loc_name: string | null;
  calories_per_100g: string;
  protein_per_100g: string;
  carbs_per_100g: string;
  fat_per_100g: string;
  fiber_per_100g: string | null;
  sugar_per_100g: string | null;
  sodium_per_100g: string | null;
  saturated_fat_per_100g: string | null;
  name_mn: string | null;
  name_en: string | null;
};

const FOODS_QUERY = `SELECT
   f.id,
   f.normalized_name,
   fl_any.name AS loc_name,
   fn.calories_per_100g,
   fn.protein_per_100g,
   fn.carbs_per_100g,
   fn.fat_per_100g,
   fn.fiber_per_100g,
   fn.sugar_per_100g,
   fn.sodium_per_100g,
   fn.saturated_fat_per_100g,
   fl_mn.name AS name_mn,
   fl_en.name AS name_en
 FROM foods f
 JOIN food_nutrients fn ON fn.food_id = f.id
 LEFT JOIN food_localizations fl_any ON fl_any.food_id = f.id
 LEFT JOIN food_localizations fl_mn  ON fl_mn.food_id = f.id  AND fl_mn.locale  = 'mn'
 LEFT JOIN food_localizations fl_en  ON fl_en.food_id = f.id  AND fl_en.locale  = 'en'
 WHERE f.status = 'approved'`;

function rowToVerifiedFood(row: FoodRow): VerifiedFoodRow {
  return {
    id: row.id,
    nameMn: row.name_mn ?? row.normalized_name,
    nameEn: row.name_en ?? row.normalized_name,
    perHundredG: {
      kcal: Number(row.calories_per_100g),
      p: Number(row.protein_per_100g),
      c: Number(row.carbs_per_100g),
      f: Number(row.fat_per_100g),
      fi: Number(row.fiber_per_100g ?? 0),
      su: Number(row.sugar_per_100g ?? 0),
      so: Number(row.sodium_per_100g ?? 0),
      sf: Number(row.saturated_fat_per_100g ?? 0),
    },
  };
}

/** Score a single name against all rows and return the best match above threshold, or null. */
function scoreAgainstRows(name: string, rows: FoodRow[]): VerifiedFoodRow | null {
  const scoreMap = new Map<string, { score: number; row: FoodRow }>();

  for (const row of rows) {
    const candidates = [row.normalized_name, row.loc_name, row.name_mn, row.name_en].filter(
      Boolean,
    ) as string[];
    const best = Math.max(...candidates.map((c) => tokenOverlap(name, c)));
    const existing = scoreMap.get(row.id);
    if (!existing || best > existing.score) {
      scoreMap.set(row.id, { score: best, row });
    }
  }

  let bestScore = 0;
  let bestRow: FoodRow | null = null;
  for (const { score, row } of scoreMap.values()) {
    if (score > bestScore) {
      bestScore = score;
      bestRow = row;
    }
  }

  if (bestScore < 0.7 || !bestRow) return null;
  return rowToVerifiedFood(bestRow);
}

/**
 * Look up a verified food in the DB by name.
 * Issues a single query per call — use lookupVerifiedFoodsBatch when matching
 * multiple items in one job to avoid N full-table scans.
 * Returns the best match if token-overlap score ≥ 0.7, else null.
 */
export async function lookupVerifiedFood(
  name: string,
  pool: Pool,
): Promise<VerifiedFoodRow | null> {
  if (!name || name.trim().length === 0) return null;

  let rows: FoodRow[];
  try {
    const result = await pool.query(FOODS_QUERY);
    rows = result.rows as FoodRow[];
  } catch (err) {
    logger.warn(
      { error: err instanceof Error ? err.message : String(err) },
      '[FoodsLookup] DB query failed, skipping match',
    );
    return null;
  }

  return scoreAgainstRows(name, rows);
}

/**
 * Batch-match multiple food names against the DB in a single query.
 * Returns a Map from input name → best VerifiedFoodRow (or null when no match ≥ 0.7).
 * Use this instead of calling lookupVerifiedFood N times per photo job.
 */
export async function lookupVerifiedFoodsBatch(
  names: string[],
  pool: Pool,
): Promise<Map<string, VerifiedFoodRow | null>> {
  const result = new Map<string, VerifiedFoodRow | null>();
  const nonEmpty = names.filter((n) => n && n.trim().length > 0);
  if (nonEmpty.length === 0) return result;

  let rows: FoodRow[];
  try {
    const queryResult = await pool.query(FOODS_QUERY);
    rows = queryResult.rows as FoodRow[];
  } catch (err) {
    logger.warn(
      { error: err instanceof Error ? err.message : String(err) },
      '[FoodsLookup] DB query failed, skipping batch match',
    );
    for (const name of names) result.set(name, null);
    return result;
  }

  for (const name of names) {
    result.set(name, scoreAgainstRows(name, rows));
  }
  return result;
}
