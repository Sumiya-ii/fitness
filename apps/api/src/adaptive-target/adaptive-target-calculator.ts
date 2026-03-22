/**
 * Pure logic for adaptive calorie target adjustments.
 *
 * Algorithm (evidence-based, similar to MacroFactor / Cronometer adaptive targets):
 *  1. Compute actual weight-change rate via ordinary least-squares linear regression
 *     over the supplied weight log entries.
 *  2. Compare against the user's stated weeklyRateKg goal.
 *  3. Decide whether to add +150 kcal/day (too fast) or subtract -100 kcal/day (too slow).
 *  4. Scale macros: protein and fat stay the same; carbs absorb the remainder.
 *
 * References:
 *  - Hall et al. (2012) 3500 kcal/lb rule revisited → ~7700 kcal/kg
 *  - Helms, Aragon & Fitschen (2014) evidence-based natural bodybuilding contest prep
 *  - MacroFactor's "Smoothed TDEE" approach (OLS trend on 4-week window)
 */

export interface WeightEntry {
  /** Calendar date in ISO-8601 format (YYYY-MM-DD). */
  date: string;
  weightKg: number;
}

export type AdjustmentReason = 'too_fast' | 'too_slow';

export interface AdjustmentDecision {
  adjustmentKcal: number; // positive = add, negative = reduce
  reason: AdjustmentReason;
  actualWeeklyRateKg: number; // signed: negative = losing, positive = gaining
}

/**
 * Minimum number of weight entries needed to compute a reliable trend.
 * With fewer than 4 data points over 4 weeks the confidence interval is too wide.
 */
export const MIN_WEIGHT_ENTRIES = 4;

/**
 * Compute the OLS linear-regression slope (kg per day) for the given weight entries.
 * Returns 0 when fewer than 2 entries are supplied (not enough data).
 */
export function computeWeightSlopeKgPerDay(entries: WeightEntry[]): number {
  if (entries.length < 2) return 0;

  // x = days since the earliest entry date, y = weightKg
  const t0 = new Date(entries[0]!.date).getTime();
  const MS_PER_DAY = 86_400_000;

  const points = entries.map((e) => ({
    x: (new Date(e.date).getTime() - t0) / MS_PER_DAY,
    y: e.weightKg,
  }));

  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return 0;

  return (n * sumXY - sumX * sumY) / denom;
}

/**
 * Decide whether a calorie adjustment is warranted given the actual weight trend
 * vs the user's target rate.
 *
 * Rules (for lose_fat goal):
 *   - Losing too fast: actualLoss > targetRate + 0.5 kg/week → +150 kcal/day
 *   - Not losing enough: actualLoss < targetRate × 0.2 → −100 kcal/day
 *
 * Symmetric rules apply for gain goal (flipped direction).
 *
 * Returns null when no adjustment is warranted or there is insufficient data.
 */
export function decideAdjustment(
  goalType: 'lose_fat' | 'gain',
  weeklyRateKg: number,
  entries: WeightEntry[],
): AdjustmentDecision | null {
  if (entries.length < MIN_WEIGHT_ENTRIES) return null;

  const slopeKgPerDay = computeWeightSlopeKgPerDay(entries);
  const actualWeeklyRateKg = slopeKgPerDay * 7; // signed kg/week

  if (goalType === 'lose_fat') {
    // Positive weeklyRateKg = intended loss rate (e.g. 0.5 kg/week)
    // actualWeeklyRateKg will be negative when weight is falling
    const actualLoss = -actualWeeklyRateKg; // positive = losing

    if (actualLoss > weeklyRateKg + 0.5) {
      return { adjustmentKcal: 150, reason: 'too_fast', actualWeeklyRateKg };
    }
    if (actualLoss < weeklyRateKg * 0.2) {
      return { adjustmentKcal: -100, reason: 'too_slow', actualWeeklyRateKg };
    }
  }

  if (goalType === 'gain') {
    // actualWeeklyRateKg will be positive when weight is rising
    const actualGain = actualWeeklyRateKg;

    if (actualGain > weeklyRateKg + 0.5) {
      return { adjustmentKcal: -150, reason: 'too_fast', actualWeeklyRateKg };
    }
    if (actualGain < weeklyRateKg * 0.2) {
      return { adjustmentKcal: 100, reason: 'too_slow', actualWeeklyRateKg };
    }
  }

  return null;
}

export interface CurrentTargetMacros {
  calorieTarget: number;
  proteinGrams: number;
  fatGrams: number;
  carbsGrams: number;
}

export interface AdjustedMacros {
  calorieTarget: number;
  proteinGrams: number;
  fatGrams: number;
  carbsGrams: number;
}

/**
 * Apply a calorie adjustment to the current macro targets.
 *
 * Strategy: protein and fat are held constant; carbs absorb the change.
 * This preserves the protein floor (1.6 g/kg body-weight) and fat minimum (20%)
 * that were set when the original target was calculated.
 *
 * The resulting calorie target is floored at 1200 kcal (minimum safe intake).
 * If carbs would go negative after the floor, fat is trimmed proportionally.
 */
export function applyCalorieAdjustment(
  current: CurrentTargetMacros,
  adjustmentKcal: number,
): AdjustedMacros {
  const newCalorieTarget = Math.max(1200, current.calorieTarget + adjustmentKcal);

  const proteinCals = current.proteinGrams * 4;
  const fatCals = current.fatGrams * 9;
  let carbsCals = newCalorieTarget - proteinCals - fatCals;

  let fatGrams = current.fatGrams;
  if (carbsCals < 0) {
    // Floor carbs to 0 and trim fat to absorb the shortfall
    const surplus = -carbsCals;
    fatGrams = Math.max(0, Math.round((fatCals - surplus) / 9));
    carbsCals = 0;
  }

  return {
    calorieTarget: newCalorieTarget,
    proteinGrams: current.proteinGrams,
    fatGrams,
    carbsGrams: Math.round(carbsCals / 4),
  };
}
