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

/**
 * Look up a verified food in the DB by name.
 * Queries foods.normalized_name + food_localizations.name (all locales).
 * Returns the best match if token-overlap score ≥ 0.7, else null.
 */
export async function lookupVerifiedFood(
  name: string,
  pool: Pool,
): Promise<VerifiedFoodRow | null> {
  if (!name || name.trim().length === 0) return null;

  // Fetch candidates: foods with their nutrients and localizations
  // We fetch ALL approved foods with nutrients to do JS-side scoring.
  // This is acceptable because the foods table is small (seeded, bounded).
  // If performance becomes an issue, add a pg_trgm index instead.
  let rows: Array<{
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
  }>;

  try {
    const result = await pool.query(
      `SELECT
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
       WHERE f.status = 'approved'`,
    );
    rows = result.rows;
  } catch (err) {
    logger.warn(
      { error: err instanceof Error ? err.message : String(err) },
      '[FoodsLookup] DB query failed, skipping match',
    );
    return null;
  }

  // Deduplicate by food id (multiple locale rows expand), take best score per food
  const scoreMap = new Map<
    string,
    {
      score: number;
      row: (typeof rows)[0];
    }
  >();

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

  // Find the highest-scoring food
  let bestScore = 0;
  let bestRow: (typeof rows)[0] | null = null;
  for (const { score, row } of scoreMap.values()) {
    if (score > bestScore) {
      bestScore = score;
      bestRow = row;
    }
  }

  if (bestScore < 0.7 || !bestRow) return null;

  return {
    id: bestRow.id,
    nameMn: bestRow.name_mn ?? bestRow.normalized_name,
    nameEn: bestRow.name_en ?? bestRow.normalized_name,
    perHundredG: {
      kcal: Number(bestRow.calories_per_100g),
      p: Number(bestRow.protein_per_100g),
      c: Number(bestRow.carbs_per_100g),
      f: Number(bestRow.fat_per_100g),
      fi: Number(bestRow.fiber_per_100g ?? 0),
      su: Number(bestRow.sugar_per_100g ?? 0),
      so: Number(bestRow.sodium_per_100g ?? 0),
      sf: Number(bestRow.saturated_fat_per_100g ?? 0),
    },
  };
}
