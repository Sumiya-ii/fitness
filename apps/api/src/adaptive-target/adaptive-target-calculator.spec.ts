import {
  computeWeightSlopeKgPerDay,
  decideAdjustment,
  applyCalorieAdjustment,
  WeightEntry,
  MIN_WEIGHT_ENTRIES,
} from './adaptive-target-calculator';

// ── Helper ───────────────────────────────────────────────────────────────────

/**
 * Build a synthetic weight series with a known slope (kg/day).
 * @param startWeight  Weight on day 0
 * @param slopeKgPerDay  Change per day (negative = loss)
 * @param days  Number of entries (one per day)
 */
function makeWeightSeries(startWeight: number, slopeKgPerDay: number, days: number): WeightEntry[] {
  const base = new Date('2026-01-01');
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return {
      date: d.toISOString().split('T')[0]!,
      weightKg: startWeight + slopeKgPerDay * i,
    };
  });
}

// ── computeWeightSlopeKgPerDay ────────────────────────────────────────────────

describe('computeWeightSlopeKgPerDay', () => {
  it('returns 0 for fewer than 2 entries', () => {
    expect(computeWeightSlopeKgPerDay([])).toBe(0);
    expect(computeWeightSlopeKgPerDay([{ date: '2026-01-01', weightKg: 80 }])).toBe(0);
  });

  it('returns the exact slope for a perfectly linear series', () => {
    // Losing 0.5 kg/week = ~0.07143 kg/day
    const series = makeWeightSeries(80, -0.5 / 7, 28);
    const slope = computeWeightSlopeKgPerDay(series);
    expect(slope).toBeCloseTo(-0.5 / 7, 5);
  });

  it('computes positive slope for weight gain', () => {
    const series = makeWeightSeries(70, 0.25 / 7, 28);
    const slope = computeWeightSlopeKgPerDay(series);
    expect(slope).toBeCloseTo(0.25 / 7, 5);
  });

  it('returns 0 when all weights are identical (zero denominator)', () => {
    const series = makeWeightSeries(75, 0, 14);
    expect(computeWeightSlopeKgPerDay(series)).toBe(0);
  });
});

// ── decideAdjustment ─────────────────────────────────────────────────────────

describe('decideAdjustment', () => {
  it('returns null when fewer than MIN_WEIGHT_ENTRIES', () => {
    const short = makeWeightSeries(80, -0.5 / 7, MIN_WEIGHT_ENTRIES - 1);
    expect(decideAdjustment('lose_fat', 0.5, short)).toBeNull();
  });

  describe('lose_fat goal', () => {
    it('returns +150 kcal when losing faster than target + 0.5 kg/week', () => {
      // target = 0.5 kg/week, actual loss = 1.2 kg/week → too fast
      const entries = makeWeightSeries(80, -1.2 / 7, 28);
      const result = decideAdjustment('lose_fat', 0.5, entries);
      expect(result).not.toBeNull();
      expect(result!.adjustmentKcal).toBe(150);
      expect(result!.reason).toBe('too_fast');
    });

    it('returns −100 kcal when not losing enough (< 20% of target)', () => {
      // target = 0.5 kg/week, actual loss ≈ 0.05 kg/week → too slow (< 0.1)
      const entries = makeWeightSeries(80, -0.05 / 7, 28);
      const result = decideAdjustment('lose_fat', 0.5, entries);
      expect(result).not.toBeNull();
      expect(result!.adjustmentKcal).toBe(-100);
      expect(result!.reason).toBe('too_slow');
    });

    it('returns null when progress is within the acceptable range', () => {
      // target = 0.5 kg/week, actual loss = 0.45 kg/week → on track
      const entries = makeWeightSeries(80, -0.45 / 7, 28);
      expect(decideAdjustment('lose_fat', 0.5, entries)).toBeNull();
    });

    it('returns null when weight is stable (no loss) but target rate is 0', () => {
      // Edge: weeklyRateKg = 0 → 20% of 0 = 0; 0 < 0 is false → no adjustment
      const entries = makeWeightSeries(80, 0, 28);
      expect(decideAdjustment('lose_fat', 0, entries)).toBeNull();
    });
  });

  describe('gain goal', () => {
    it('returns −150 kcal when gaining faster than target + 0.5 kg/week', () => {
      // target = 0.25 kg/week, actual gain = 0.9 kg/week → too fast
      const entries = makeWeightSeries(70, 0.9 / 7, 28);
      const result = decideAdjustment('gain', 0.25, entries);
      expect(result).not.toBeNull();
      expect(result!.adjustmentKcal).toBe(-150);
      expect(result!.reason).toBe('too_fast');
    });

    it('returns +100 kcal when not gaining enough (< 20% of target)', () => {
      // target = 0.25 kg/week, actual gain = 0.02 kg/week → too slow
      const entries = makeWeightSeries(70, 0.02 / 7, 28);
      const result = decideAdjustment('gain', 0.25, entries);
      expect(result).not.toBeNull();
      expect(result!.adjustmentKcal).toBe(100);
      expect(result!.reason).toBe('too_slow');
    });

    it('returns null when gaining within the acceptable range', () => {
      const entries = makeWeightSeries(70, 0.22 / 7, 28);
      expect(decideAdjustment('gain', 0.25, entries)).toBeNull();
    });
  });
});

// ── applyCalorieAdjustment ───────────────────────────────────────────────────

describe('applyCalorieAdjustment', () => {
  // protein = 150g → 600 kcal, fat = 55g → 495 kcal, carbs = (2000-1095)/4 = 226g
  const base = { calorieTarget: 2000, proteinGrams: 150, fatGrams: 55, carbsGrams: 226 };

  it('adds kcal primarily to carbs, keeping protein and fat unchanged', () => {
    const result = applyCalorieAdjustment(base, 150);
    expect(result.calorieTarget).toBe(2150);
    expect(result.proteinGrams).toBe(150);
    expect(result.fatGrams).toBe(55);
    // carbs should absorb the extra 150 kcal → +37-38 g
    expect(result.carbsGrams).toBeGreaterThan(base.carbsGrams);
  });

  it('subtracts kcal from carbs, keeping protein and fat unchanged', () => {
    const result = applyCalorieAdjustment(base, -100);
    expect(result.calorieTarget).toBe(1900);
    expect(result.proteinGrams).toBe(150);
    expect(result.fatGrams).toBe(55);
    expect(result.carbsGrams).toBeLessThan(base.carbsGrams);
  });

  it('floors calorieTarget at 1200', () => {
    const veryLow = { calorieTarget: 1250, proteinGrams: 150, fatGrams: 55, carbsGrams: 20 };
    const result = applyCalorieAdjustment(veryLow, -100);
    expect(result.calorieTarget).toBe(1200);
  });

  it('trims fat when carbs would go negative after floor', () => {
    // protein (150g=600kcal) + fat (80g=720kcal) = 1320 kcal
    // calorieTarget = 1300 after adjustment → carbs would be -20 kcal → trim fat
    const tight = { calorieTarget: 1400, proteinGrams: 150, fatGrams: 80, carbsGrams: 20 };
    const result = applyCalorieAdjustment(tight, -100);
    expect(result.carbsGrams).toBe(0);
    expect(result.fatGrams).toBeLessThan(80);
    expect(result.proteinGrams).toBe(150);
    expect(result.calorieTarget).toBe(1300);
  });
});
