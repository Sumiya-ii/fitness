/**
 * Adaptive calorie target integration tests.
 *
 * Tests the full pipeline: weight entries → OLS regression → decision → macro adjustment.
 * Pure computation — no external API calls required.
 *
 * Validates:
 *   - OLS linear regression slope accuracy
 *   - Decision thresholds (too_fast / too_slow / no adjustment)
 *   - Macro scaling (carbs absorb change, protein/fat held constant)
 *   - Safety floors (1200 kcal minimum, fat trimming)
 *   - Edge cases (insufficient data, flat weight, extreme values)
 */

// Import directly from the API calculator (pure functions, no dependencies)
import {
  computeWeightSlopeKgPerDay,
  decideAdjustment,
  applyCalorieAdjustment,
  MIN_WEIGHT_ENTRIES,
  type WeightEntry,
  type CurrentTargetMacros,
} from '../../api/src/adaptive-target/adaptive-target-calculator';

// ── Test data generators ────────────────────────────────────────────────────────

/** Generate weight entries with a linear trend over N days */
function generateLinearWeightEntries(
  startWeight: number,
  dailyChange: number,
  days: number,
  startDate = '2026-03-01',
): WeightEntry[] {
  const entries: WeightEntry[] = [];
  const [y, m, d] = startDate.split('-').map(Number);
  for (let i = 0; i < days; i++) {
    // Build ISO date string directly to avoid timezone issues with Date object
    const dt = new Date(Date.UTC(y!, m! - 1, d! + i));
    const iso = dt.toISOString().split('T')[0]!;
    entries.push({
      date: iso,
      weightKg: startWeight + dailyChange * i,
    });
  }
  return entries;
}

/** Add gaussian noise to weight entries (simulates real weigh-ins) */
function addNoise(entries: WeightEntry[], stddev: number): WeightEntry[] {
  // Simple deterministic "noise" using index-based variation
  return entries.map((e, i) => ({
    ...e,
    weightKg: e.weightKg + Math.sin(i * 1.7) * stddev,
  }));
}

// ── OLS regression tests ────────────────────────────────────────────────────────

describe('Adaptive targets: OLS weight slope', () => {
  it('returns 0 for fewer than 2 entries', () => {
    expect(computeWeightSlopeKgPerDay([])).toBe(0);
    expect(computeWeightSlopeKgPerDay([{ date: '2026-03-01', weightKg: 80 }])).toBe(0);
  });

  it('computes exact slope for perfect linear data', () => {
    // Losing 0.1 kg/day = 0.7 kg/week
    const entries = generateLinearWeightEntries(85, -0.1, 14);
    const slope = computeWeightSlopeKgPerDay(entries);

    expect(slope).toBeCloseTo(-0.1, 4);
  });

  it('computes positive slope for weight gain', () => {
    // Gaining 0.05 kg/day = 0.35 kg/week
    const entries = generateLinearWeightEntries(70, 0.05, 21);
    const slope = computeWeightSlopeKgPerDay(entries);

    expect(slope).toBeCloseTo(0.05, 4);
  });

  it('computes zero slope for flat weight', () => {
    const entries = generateLinearWeightEntries(80, 0, 14);
    const slope = computeWeightSlopeKgPerDay(entries);

    expect(slope).toBeCloseTo(0, 4);
  });

  it('handles noisy data (regression averages out noise)', () => {
    // True trend: -0.08 kg/day, with ±0.5 kg noise
    const perfect = generateLinearWeightEntries(82, -0.08, 28);
    const noisy = addNoise(perfect, 0.5);
    const slope = computeWeightSlopeKgPerDay(noisy);

    // Should be close to the true trend, within noise tolerance
    expect(slope).toBeLessThan(0); // Still negative
    expect(slope).toBeCloseTo(-0.08, 1); // Within 0.05 of true value
  });

  it('handles 2-entry minimum', () => {
    const entries: WeightEntry[] = [
      { date: '2026-03-01', weightKg: 80 },
      { date: '2026-03-08', weightKg: 79.3 },
    ];
    const slope = computeWeightSlopeKgPerDay(entries);

    // -0.7 kg over 7 days = -0.1 kg/day
    expect(slope).toBeCloseTo(-0.1, 4);
  });
});

// ── Decision logic tests ────────────────────────────────────────────────────────

describe('Adaptive targets: adjustment decisions', () => {
  it('returns null with insufficient data', () => {
    const entries = generateLinearWeightEntries(80, -0.1, 3);
    expect(entries.length).toBeLessThan(MIN_WEIGHT_ENTRIES);
    expect(decideAdjustment('lose_fat', 0.5, entries)).toBeNull();
  });

  describe('lose_fat goal', () => {
    it('returns +150 kcal when losing too fast', () => {
      // Target: 0.5 kg/week. Actual: losing 1.2 kg/week (> 0.5 + 0.5 threshold)
      const entries = generateLinearWeightEntries(85, -1.2 / 7, 28);
      const decision = decideAdjustment('lose_fat', 0.5, entries);

      expect(decision).not.toBeNull();
      expect(decision!.reason).toBe('too_fast');
      expect(decision!.adjustmentKcal).toBe(150);
      expect(decision!.actualWeeklyRateKg).toBeCloseTo(-1.2, 1);
    });

    it('returns -100 kcal when losing too slowly', () => {
      // Target: 0.5 kg/week. Actual: losing 0.05 kg/week (< 0.5 * 0.2 = 0.1)
      const entries = generateLinearWeightEntries(85, -0.05 / 7, 28);
      const decision = decideAdjustment('lose_fat', 0.5, entries);

      expect(decision).not.toBeNull();
      expect(decision!.reason).toBe('too_slow');
      expect(decision!.adjustmentKcal).toBe(-100);
    });

    it('returns null when loss rate is on target', () => {
      // Target: 0.5 kg/week. Actual: losing 0.45 kg/week (within acceptable range)
      const entries = generateLinearWeightEntries(85, -0.45 / 7, 28);
      const decision = decideAdjustment('lose_fat', 0.5, entries);

      expect(decision).toBeNull();
    });

    it('returns null when slightly slow but above 20% threshold', () => {
      // Target: 0.5 kg/week. Actual: losing 0.15 kg/week (> 0.5 * 0.2 = 0.1, < 0.5)
      const entries = generateLinearWeightEntries(85, -0.15 / 7, 28);
      const decision = decideAdjustment('lose_fat', 0.5, entries);

      expect(decision).toBeNull();
    });

    it('triggers too_slow when gaining weight on a fat loss goal', () => {
      // Target: 0.5 kg/week loss. Actual: gaining 0.2 kg/week
      const entries = generateLinearWeightEntries(85, 0.2 / 7, 28);
      const decision = decideAdjustment('lose_fat', 0.5, entries);

      expect(decision).not.toBeNull();
      expect(decision!.reason).toBe('too_slow');
      expect(decision!.adjustmentKcal).toBe(-100);
    });
  });

  describe('gain goal', () => {
    it('returns -150 kcal when gaining too fast', () => {
      // Target: 0.3 kg/week. Actual: gaining 1.0 kg/week (> 0.3 + 0.5)
      const entries = generateLinearWeightEntries(70, 1.0 / 7, 28);
      const decision = decideAdjustment('gain', 0.3, entries);

      expect(decision).not.toBeNull();
      expect(decision!.reason).toBe('too_fast');
      expect(decision!.adjustmentKcal).toBe(-150);
    });

    it('returns +100 kcal when gaining too slowly', () => {
      // Target: 0.3 kg/week. Actual: gaining 0.03 kg/week (< 0.3 * 0.2 = 0.06)
      const entries = generateLinearWeightEntries(70, 0.03 / 7, 28);
      const decision = decideAdjustment('gain', 0.3, entries);

      expect(decision).not.toBeNull();
      expect(decision!.reason).toBe('too_slow');
      expect(decision!.adjustmentKcal).toBe(100);
    });

    it('returns null when gain rate is on target', () => {
      // Target: 0.3 kg/week. Actual: gaining 0.25 kg/week
      const entries = generateLinearWeightEntries(70, 0.25 / 7, 28);
      const decision = decideAdjustment('gain', 0.3, entries);

      expect(decision).toBeNull();
    });

    it('triggers too_slow when losing weight on a gain goal', () => {
      // Target: 0.3 kg/week gain. Actual: losing 0.1 kg/week
      const entries = generateLinearWeightEntries(70, -0.1 / 7, 28);
      const decision = decideAdjustment('gain', 0.3, entries);

      expect(decision).not.toBeNull();
      expect(decision!.reason).toBe('too_slow');
      expect(decision!.adjustmentKcal).toBe(100);
    });
  });
});

// ── Macro adjustment tests ──────────────────────────────────────────────────────

describe('Adaptive targets: macro adjustment', () => {
  const baseMacros: CurrentTargetMacros = {
    calorieTarget: 2000,
    proteinGrams: 120, // 480 kcal
    fatGrams: 67, // 603 kcal
    carbsGrams: 229, // 916 kcal ≈ 2000 total
  };

  it('adds calories by increasing carbs only', () => {
    const result = applyCalorieAdjustment(baseMacros, 150);

    expect(result.calorieTarget).toBe(2150);
    expect(result.proteinGrams).toBe(120); // unchanged
    expect(result.fatGrams).toBe(67); // unchanged
    // Extra 150 kcal / 4 = 37.5g more carbs
    expect(result.carbsGrams).toBe(Math.round((2150 - 480 - 603) / 4));
  });

  it('subtracts calories by reducing carbs only', () => {
    const result = applyCalorieAdjustment(baseMacros, -100);

    expect(result.calorieTarget).toBe(1900);
    expect(result.proteinGrams).toBe(120);
    expect(result.fatGrams).toBe(67);
    expect(result.carbsGrams).toBe(Math.round((1900 - 480 - 603) / 4));
  });

  it('floors at 1200 kcal minimum', () => {
    const lowMacros: CurrentTargetMacros = {
      calorieTarget: 1250,
      proteinGrams: 100,
      fatGrams: 50,
      carbsGrams: 81,
    };

    const result = applyCalorieAdjustment(lowMacros, -100);

    expect(result.calorieTarget).toBe(1200); // Floored, not 1150
    expect(result.proteinGrams).toBe(100);
  });

  it('trims fat when carbs would go negative', () => {
    // Protein: 150g (600 kcal), Fat: 80g (720 kcal), Carbs: 20g (80 kcal)
    // Total: 1400 kcal. After -300 → 1200 kcal floor.
    // proteinCals + fatCals = 1320, exceeds 1200 → carbs would be negative
    const highProteinFat: CurrentTargetMacros = {
      calorieTarget: 1400,
      proteinGrams: 150,
      fatGrams: 80,
      carbsGrams: 20,
    };

    const result = applyCalorieAdjustment(highProteinFat, -300);

    expect(result.calorieTarget).toBe(1200); // Floored
    expect(result.proteinGrams).toBe(150); // Protein always preserved
    expect(result.carbsGrams).toBe(0); // Carbs floored to 0
    expect(result.fatGrams).toBeLessThan(80); // Fat trimmed
    expect(result.fatGrams).toBeGreaterThanOrEqual(0);
  });

  it('handles zero adjustment', () => {
    const result = applyCalorieAdjustment(baseMacros, 0);

    expect(result.calorieTarget).toBe(2000);
    expect(result.proteinGrams).toBe(120);
    expect(result.fatGrams).toBe(67);
    expect(result.carbsGrams).toBe(229);
  });
});

// ── End-to-end scenarios ────────────────────────────────────────────────────────

describe('Adaptive targets: end-to-end scenarios', () => {
  it('full pipeline: steady weight loss user gets no adjustment', () => {
    // User targeting 0.5 kg/week loss, actually losing 0.4 kg/week
    const entries = generateLinearWeightEntries(85, -0.4 / 7, 28);
    const decision = decideAdjustment('lose_fat', 0.5, entries);

    expect(decision).toBeNull();
    // No macro changes needed — user is on track
  });

  it('full pipeline: crash dieter gets calorie increase', () => {
    // User targeting 0.5 kg/week loss but losing 1.5 kg/week
    const entries = addNoise(generateLinearWeightEntries(90, -1.5 / 7, 28), 0.3);
    const decision = decideAdjustment('lose_fat', 0.5, entries);

    expect(decision).not.toBeNull();
    expect(decision!.reason).toBe('too_fast');
    expect(decision!.adjustmentKcal).toBe(150);

    const currentMacros: CurrentTargetMacros = {
      calorieTarget: 1500,
      proteinGrams: 130,
      fatGrams: 50,
      carbsGrams: 120,
    };

    const newMacros = applyCalorieAdjustment(currentMacros, decision!.adjustmentKcal);

    expect(newMacros.calorieTarget).toBe(1650);
    expect(newMacros.proteinGrams).toBe(130); // Preserved
    expect(newMacros.fatGrams).toBe(50); // Preserved
    expect(newMacros.carbsGrams).toBeGreaterThan(currentMacros.carbsGrams); // Carbs increased
  });

  it('full pipeline: stalled user gets calorie decrease', () => {
    // User targeting 0.5 kg/week loss but weight is flat
    const entries = addNoise(generateLinearWeightEntries(82, 0, 28), 0.2);
    const decision = decideAdjustment('lose_fat', 0.5, entries);

    expect(decision).not.toBeNull();
    expect(decision!.reason).toBe('too_slow');
    expect(decision!.adjustmentKcal).toBe(-100);

    const currentMacros: CurrentTargetMacros = {
      calorieTarget: 2000,
      proteinGrams: 120,
      fatGrams: 67,
      carbsGrams: 229,
    };

    const newMacros = applyCalorieAdjustment(currentMacros, decision!.adjustmentKcal);

    expect(newMacros.calorieTarget).toBe(1900);
    expect(newMacros.carbsGrams).toBeLessThan(currentMacros.carbsGrams);
  });

  it('full pipeline: bulking user gaining too fast', () => {
    // User targeting 0.3 kg/week gain but gaining 1.0 kg/week
    const entries = generateLinearWeightEntries(72, 1.0 / 7, 28);
    const decision = decideAdjustment('gain', 0.3, entries);

    expect(decision).not.toBeNull();
    expect(decision!.reason).toBe('too_fast');
    expect(decision!.adjustmentKcal).toBe(-150);

    // Macros must be internally consistent: 150*4 + 90*9 + 398*4 = 600+810+1592 = 3002 ≈ 3000
    const currentMacros: CurrentTargetMacros = {
      calorieTarget: 3000,
      proteinGrams: 150,
      fatGrams: 90,
      carbsGrams: 398,
    };

    const newMacros = applyCalorieAdjustment(currentMacros, decision!.adjustmentKcal);

    expect(newMacros.calorieTarget).toBe(2850);
    expect(newMacros.proteinGrams).toBe(150);
    expect(newMacros.fatGrams).toBe(90);
    expect(newMacros.carbsGrams).toBeLessThan(398);
  });

  it('full pipeline: near-floor user stays above 1200 kcal', () => {
    // Already at 1250 kcal, weight stalled → should not go below 1200
    const entries = generateLinearWeightEntries(60, 0, 28);
    const decision = decideAdjustment('lose_fat', 0.5, entries);

    expect(decision).not.toBeNull();
    expect(decision!.adjustmentKcal).toBe(-100);

    const currentMacros: CurrentTargetMacros = {
      calorieTarget: 1250,
      proteinGrams: 100,
      fatGrams: 45,
      carbsGrams: 69,
    };

    const newMacros = applyCalorieAdjustment(currentMacros, decision!.adjustmentKcal);

    expect(newMacros.calorieTarget).toBe(1200); // Floored
    expect(newMacros.calorieTarget).toBeGreaterThanOrEqual(1200);
  });
});
