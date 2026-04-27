/**
 * Map a freeform user-spoken food name to a canonical id.
 *
 * Strategy (in order of priority):
 *   1. Exact match against the prebuilt name+alias index (lowercased)
 *   2. Cyrillic ↔ Latin transliteration both ways, then exact match
 *   3. Fuzzy match (Levenshtein-based ratio) against all index keys, threshold 0.85
 *   4. Generic-name guard: "мах" / "soup" / "meat" alone → null (don't pin to one)
 *
 * Pure, deterministic, sync. Safe to call per-item in hot paths (sub-millisecond).
 */

import { CANONICAL_BY_NAME } from './mn-canonical';

/** Generic single-word names that should NOT auto-canonicalize. */
const GENERIC_NAMES = new Set([
  'мах',
  'meat',
  'хоол',
  'food',
  'meal',
  'шөл',
  'soup',
  'будаа',
  'rice',
  'цай',
  'tea',
  'drink',
  'ундаа',
  'snack',
  'зууш',
]);

/**
 * Romanize Cyrillic Mongolian → Latin (best-effort, lossy).
 * Mirrors the convention used in MONGOLIAN_FOOD_REFERENCE: kh, ts, ch, sh, etc.
 */
const CYR_TO_LAT: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'yo',
  ж: 'j',
  з: 'z',
  и: 'i',
  й: 'i',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  ө: 'u',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ү: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sh',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

function romanize(input: string): string {
  let out = '';
  for (const ch of input.toLowerCase()) {
    out += CYR_TO_LAT[ch] ?? ch;
  }
  return out;
}

/**
 * Latin → Cyrillic (best-effort). Only used to widen exact-match coverage —
 * "buuz" → "буз" lets us hit the alias for "Бууз" without a full alias entry.
 *
 * Order matters: digraphs (kh, ts, ch, sh, yo, yu, ya) before single chars.
 */
const LAT_TO_CYR_DIGRAPHS: Array<[string, string]> = [
  ['kh', 'х'],
  ['ts', 'ц'],
  ['ch', 'ч'],
  ['sh', 'ш'],
  ['yo', 'ё'],
  ['yu', 'ю'],
  ['ya', 'я'],
];
const LAT_TO_CYR_SINGLES: Record<string, string> = {
  a: 'а',
  b: 'б',
  c: 'к',
  d: 'д',
  e: 'э',
  f: 'ф',
  g: 'г',
  h: 'х',
  i: 'и',
  j: 'ж',
  k: 'к',
  l: 'л',
  m: 'м',
  n: 'н',
  o: 'о',
  p: 'п',
  q: 'к',
  r: 'р',
  s: 'с',
  t: 'т',
  u: 'у',
  v: 'в',
  w: 'в',
  x: 'х',
  y: 'й',
  z: 'з',
};

function cyrillicize(input: string): string {
  let s = input.toLowerCase();
  for (const [lat, cyr] of LAT_TO_CYR_DIGRAPHS) {
    s = s.split(lat).join(cyr);
  }
  let out = '';
  for (const ch of s) {
    out += LAT_TO_CYR_SINGLES[ch] ?? ch;
  }
  return out;
}

/** Strip diacritics and collapse whitespace. */
function clean(input: string): string {
  return input.trim().toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
}

/** Standard Levenshtein distance. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let curr = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const next = Math.min(prev[j] + 1, curr + 1, prev[j - 1] + cost);
      prev[j - 1] = curr;
      curr = next;
    }
    prev[b.length] = curr;
  }
  return prev[b.length];
}

/**
 * Similarity ratio in [0, 1]: 1 = identical, 0 = nothing in common.
 */
function similarity(a: string, b: string): number {
  const len = Math.max(a.length, b.length);
  if (len === 0) return 1;
  return 1 - levenshtein(a, b) / len;
}

export interface CanonicalizeResult {
  /** Canonical id, or null when no confident match. */
  id: string | null;
  /** 1.0 = exact, 0.95 = transliteration match, 0.7-0.94 = fuzzy, 0 = no match. */
  confidence: number;
}

/**
 * Map a raw food name to a canonical id.
 * Returns `{ id: null, confidence: 0 }` when the name is generic
 * (e.g. just "meat") or when no candidate clears the fuzzy threshold.
 */
export function canonicalize(rawName: string): CanonicalizeResult {
  if (typeof rawName !== 'string') return { id: null, confidence: 0 };
  const cleaned = clean(rawName);
  if (cleaned.length === 0) return { id: null, confidence: 0 };

  // Reject generic single-word names — these need disambiguation, not pinning.
  if (GENERIC_NAMES.has(cleaned)) {
    return { id: null, confidence: 0 };
  }

  // 1. Exact match.
  const direct = CANONICAL_BY_NAME.get(cleaned);
  if (direct) return { id: direct, confidence: 1 };

  // 2. Transliteration round-trip.
  const romanized = clean(romanize(cleaned));
  if (romanized !== cleaned) {
    const hit = CANONICAL_BY_NAME.get(romanized);
    if (hit) return { id: hit, confidence: 0.95 };
  }
  const cyrillicized = clean(cyrillicize(cleaned));
  if (cyrillicized !== cleaned) {
    const hit = CANONICAL_BY_NAME.get(cyrillicized);
    if (hit) return { id: hit, confidence: 0.95 };
  }

  // 3. Fuzzy match — try both raw cleaned and romanized forms vs all keys.
  const candidates = [cleaned, romanized].filter((v, i, a) => v && a.indexOf(v) === i);
  let bestId: string | null = null;
  let bestRatio = 0;

  for (const [key, id] of CANONICAL_BY_NAME) {
    // Cheap length-gate to skip obviously distant keys before O(n*m) edit-distance.
    const minLen = Math.min(key.length, cleaned.length);
    const maxLen = Math.max(key.length, cleaned.length);
    if (minLen / maxLen < 0.6) continue;

    for (const cand of candidates) {
      const ratio = similarity(cand, key);
      if (ratio > bestRatio) {
        bestRatio = ratio;
        bestId = id;
      }
    }
  }

  if (bestId && bestRatio >= 0.85) {
    return { id: bestId, confidence: Number(bestRatio.toFixed(2)) };
  }

  return { id: null, confidence: 0 };
}
