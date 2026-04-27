import {
  CALIBRATION_MAX_SAMPLES_KEPT,
  CALIBRATION_RATIO_MAX,
  CALIBRATION_RATIO_MIN,
  appendSample,
  applySample,
  clampRatio,
  computeRatio,
  median,
  scaleNutrition,
  shouldApplyCalibration,
} from './calibration';

describe('calibration', () => {
  describe('clampRatio', () => {
    it('clamps below floor', () => {
      expect(clampRatio(0.1)).toBe(CALIBRATION_RATIO_MIN);
    });
    it('clamps above ceiling', () => {
      expect(clampRatio(10)).toBe(CALIBRATION_RATIO_MAX);
    });
    it('falls back to 1 for non-finite', () => {
      expect(clampRatio(NaN)).toBe(1);
      expect(clampRatio(Infinity)).toBe(1);
    });
    it('passes through normal values', () => {
      expect(clampRatio(0.78)).toBe(0.78);
    });
  });

  describe('computeRatio', () => {
    it('returns clamped ratio for the бууз case', () => {
      // estimate 360, user saved 280 -> 0.778
      expect(computeRatio(360, 280)).toBeCloseTo(0.778, 2);
    });
    it('returns null for non-positive originals', () => {
      expect(computeRatio(0, 100)).toBeNull();
      expect(computeRatio(-10, 100)).toBeNull();
    });
    it('returns null for non-positive corrections', () => {
      expect(computeRatio(100, 0)).toBeNull();
    });
    it('clamps extreme over-corrections', () => {
      expect(computeRatio(100, 10000)).toBe(CALIBRATION_RATIO_MAX);
    });
  });

  describe('median', () => {
    it('odd count picks middle', () => {
      expect(median([1, 2, 3])).toBe(2);
    });
    it('even count averages two middles', () => {
      expect(median([1, 2, 3, 4])).toBe(2.5);
    });
    it('handles unsorted input', () => {
      expect(median([5, 1, 3])).toBe(3);
    });
    it('returns 1 for empty array (neutral default)', () => {
      expect(median([])).toBe(1);
    });
  });

  describe('appendSample', () => {
    it('appends below cap', () => {
      expect(appendSample([0.8, 0.9], 1.0)).toEqual([0.8, 0.9, 1.0]);
    });
    it('drops oldest when at cap', () => {
      const ten = Array.from({ length: CALIBRATION_MAX_SAMPLES_KEPT }, (_, i) => 1 + i * 0.01);
      const next = appendSample(ten, 2.0);
      expect(next).toHaveLength(CALIBRATION_MAX_SAMPLES_KEPT);
      expect(next[next.length - 1]).toBe(2.0);
      expect(next[0]).toBe(ten[1]); // first element shifted out
    });
  });

  describe('applySample', () => {
    it('seeds state from null', () => {
      const s = applySample(null, 0.8);
      expect(s.sampleCount).toBe(1);
      expect(s.recentSamples).toEqual([0.8]);
      expect(s.medianRatio).toBe(0.8);
    });
    it('updates median across multiple samples', () => {
      let s = applySample(null, 0.8);
      s = applySample(s, 0.9);
      s = applySample(s, 1.0);
      expect(s.sampleCount).toBe(3);
      expect(s.medianRatio).toBe(0.9);
    });
    it('clamps incoming sample', () => {
      const s = applySample(null, 5);
      expect(s.recentSamples).toEqual([CALIBRATION_RATIO_MAX]);
    });
  });

  describe('scaleNutrition', () => {
    it('returns same object when ratio === 1', () => {
      const item = { calories: 100, protein: 10, carbs: 5, fat: 2 };
      expect(scaleNutrition(item, 1)).toBe(item);
    });
    it('scales calories and macros', () => {
      const out = scaleNutrition({ calories: 360, protein: 28, carbs: 30, fat: 14 }, 0.778);
      expect(out.calories).toBeCloseTo(280.08, 1);
      expect(out.protein).toBeCloseTo(21.78, 1);
    });
    it('preserves and scales optional fields when present', () => {
      const input: {
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
        fiber?: number;
        sugar?: number;
        sodium?: number;
      } = { calories: 100, protein: 10, carbs: 5, fat: 2, fiber: 4, sodium: 200 };
      const out = scaleNutrition(input, 0.5);
      expect(out.fiber).toBe(2);
      expect(out.sodium).toBe(100);
      expect(out.sugar).toBeUndefined();
    });
    it('clamps the ratio it actually applies', () => {
      const out = scaleNutrition({ calories: 100, protein: 10, carbs: 5, fat: 2 }, 100);
      expect(out.calories).toBe(100 * CALIBRATION_RATIO_MAX);
    });
  });

  describe('shouldApplyCalibration', () => {
    it('false below 3 samples', () => {
      expect(shouldApplyCalibration({ sampleCount: 2 })).toBe(false);
    });
    it('true at 3+ samples', () => {
      expect(shouldApplyCalibration({ sampleCount: 3 })).toBe(true);
      expect(shouldApplyCalibration({ sampleCount: 50 })).toBe(true);
    });
  });
});
