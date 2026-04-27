/**
 * Per-user food calibration math (Phase B of voice-logging accuracy work).
 *
 * Pure helpers — no IO. The API records corrections, the worker reads ratios
 * before parse-time decisions; both go through these functions so the bounds,
 * sample-window size, and median behaviour stay consistent.
 *
 * Why this shape:
 *   - We trust the median of recent samples, not a running mean. One bad edit
 *     (user fat-fingers a quantity) shouldn't move the dial much.
 *   - Ratios are clamped to [0.4, 2.5] so a single extreme correction can't
 *     halve or quadruple future estimates for that food.
 *   - Only apply once we have ≥3 samples — below that we don't have enough
 *     signal to override the model.
 */

export const CALIBRATION_RATIO_MIN = 0.4;
export const CALIBRATION_RATIO_MAX = 2.5;
export const CALIBRATION_MIN_SAMPLES_TO_APPLY = 3;
export const CALIBRATION_MAX_SAMPLES_KEPT = 10;

export function clampRatio(r: number): number {
  if (!Number.isFinite(r)) return 1;
  return Math.min(CALIBRATION_RATIO_MAX, Math.max(CALIBRATION_RATIO_MIN, r));
}

/**
 * Compute a corrected/original ratio. Returns null when either side is
 * non-positive — those samples carry no signal.
 */
export function computeRatio(originalKcal: number, correctedKcal: number): number | null {
  if (!Number.isFinite(originalKcal) || !Number.isFinite(correctedKcal)) return null;
  if (originalKcal <= 0 || correctedKcal <= 0) return null;
  return clampRatio(correctedKcal / originalKcal);
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 1;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function appendSample(prev: readonly number[], next: number): number[] {
  const combined = [...prev, next];
  if (combined.length <= CALIBRATION_MAX_SAMPLES_KEPT) return combined;
  return combined.slice(combined.length - CALIBRATION_MAX_SAMPLES_KEPT);
}

export interface CalibrationState {
  recentSamples: number[];
  medianRatio: number;
  sampleCount: number;
}

export function applySample(prev: CalibrationState | null, ratio: number): CalibrationState {
  const samples = appendSample(prev?.recentSamples ?? [], clampRatio(ratio));
  return {
    recentSamples: samples,
    medianRatio: median(samples),
    sampleCount: (prev?.sampleCount ?? 0) + 1,
  };
}

/**
 * Scale a parsed item's calories + macros by `ratio`. Returns a new object;
 * never mutates the input. Optional fields stay optional. Confidence is left
 * alone — calibration changes the magnitude, not the model's certainty about
 * the food identity.
 */
export interface ScalableNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  saturatedFat?: number;
}

export function scaleNutrition<T extends ScalableNutrition>(item: T, ratio: number): T {
  if (ratio === 1) return item;
  const r = clampRatio(ratio);
  const out: T = {
    ...item,
    calories: Math.max(0, item.calories * r),
    protein: Math.max(0, item.protein * r),
    carbs: Math.max(0, item.carbs * r),
    fat: Math.max(0, item.fat * r),
  };
  if (typeof item.fiber === 'number') out.fiber = Math.max(0, item.fiber * r);
  if (typeof item.sugar === 'number') out.sugar = Math.max(0, item.sugar * r);
  if (typeof item.sodium === 'number') out.sodium = Math.max(0, item.sodium * r);
  if (typeof item.saturatedFat === 'number') out.saturatedFat = Math.max(0, item.saturatedFat * r);
  return out;
}

export function shouldApplyCalibration(state: { sampleCount: number }): boolean {
  return state.sampleCount >= CALIBRATION_MIN_SAMPLES_TO_APPLY;
}
