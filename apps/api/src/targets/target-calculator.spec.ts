import { calculateTargets, calculateBMR, CalcInput } from './target-calculator';

/**
 * Mifflin-St Jeor published reference values.
 * Formula: men = 10w + 6.25h - 5a + 5 ; women = 10w + 6.25h - 5a - 161
 * Sources: Mifflin MD et al., JADA 1990; Frankenfield et al., JADA 2005.
 */
describe('calculateBMR — Mifflin-St Jeor exact values', () => {
  const cases: Array<{
    label: string;
    gender: string;
    weightKg: number;
    heightCm: number;
    age: number;
    expectedBMR: number;
  }> = [
    // Male: 10*70 + 6.25*175 - 5*30 + 5 = 700 + 1093.75 - 150 + 5 = 1648.75
    {
      label: 'male 70 kg / 175 cm / 30 y',
      gender: 'male',
      weightKg: 70,
      heightCm: 175,
      age: 30,
      expectedBMR: 1648.75,
    },
    // Female: 10*60 + 6.25*165 - 5*30 - 161 = 600 + 1031.25 - 150 - 161 = 1320.25
    {
      label: 'female 60 kg / 165 cm / 30 y',
      gender: 'female',
      weightKg: 60,
      heightCm: 165,
      age: 30,
      expectedBMR: 1320.25,
    },
    // Male heavy/tall: 10*100 + 6.25*190 - 5*25 + 5 = 1000 + 1187.5 - 125 + 5 = 2067.5
    {
      label: 'male 100 kg / 190 cm / 25 y',
      gender: 'male',
      weightKg: 100,
      heightCm: 190,
      age: 25,
      expectedBMR: 2067.5,
    },
    // Female older: 10*55 + 6.25*158 - 5*50 - 161 = 550 + 987.5 - 250 - 161 = 1126.5
    {
      label: 'female 55 kg / 158 cm / 50 y',
      gender: 'female',
      weightKg: 55,
      heightCm: 158,
      age: 50,
      expectedBMR: 1126.5,
    },
    // Other (average of male+female for same params):
    // male: 10*70 + 6.25*170 - 5*35 + 5 = 700 + 1062.5 - 175 + 5 = 1592.5
    // female: 10*70 + 6.25*170 - 5*35 - 161 = 700 + 1062.5 - 175 - 161 = 1426.5
    // other: (1592.5 + 1426.5) / 2 = 1509.5
    {
      label: 'other 70 kg / 170 cm / 35 y (avg)',
      gender: 'other',
      weightKg: 70,
      heightCm: 170,
      age: 35,
      expectedBMR: 1509.5,
    },
  ];

  it.each(cases)(
    '$label → BMR = $expectedBMR',
    ({ gender, weightKg, heightCm, age, expectedBMR }) => {
      expect(calculateBMR(gender, weightKg, heightCm, age)).toBe(expectedBMR);
    },
  );
});

describe('calculateTargets', () => {
  const baseInput: CalcInput = {
    gender: 'male',
    birthDate: '1990-01-15',
    heightCm: 175,
    weightKg: 80,
    activityLevel: 'moderately_active',
    goalType: 'maintain',
    weeklyRateKg: 0,
  };

  it('should calculate maintenance calories for male', () => {
    const result = calculateTargets(baseInput);
    // BMR = 10*80 + 6.25*175 - 5*36 + 5 = 800 + 1093.75 - 180 + 5 = 1718.75
    // TDEE = 1719 * 1.55 ≈ 2664
    expect(result.tdee).toBeGreaterThan(2500);
    expect(result.tdee).toBeLessThan(2800);
    expect(result.calorieTarget).toBe(result.tdee);
  });

  it('should calculate maintenance calories for female', () => {
    const result = calculateTargets({ ...baseInput, gender: 'female', weightKg: 65 });
    // BMR = 10*65 + 6.25*175 - 5*36 - 161 = 650 + 1093.75 - 180 - 161 = 1402.75
    // TDEE = 1403 * 1.55 ≈ 2175
    expect(result.tdee).toBeGreaterThan(2000);
    expect(result.tdee).toBeLessThan(2300);
  });

  it('should apply deficit for lose_fat goal', () => {
    const maintain = calculateTargets(baseInput);
    const loseFat = calculateTargets({
      ...baseInput,
      goalType: 'lose_fat',
      weeklyRateKg: 0.5,
    });

    // 0.5 kg/week × 7700 kcal/kg / 7 ≈ 550 kcal/day deficit
    expect(loseFat.calorieTarget).toBeLessThan(maintain.calorieTarget);
    expect(maintain.calorieTarget - loseFat.calorieTarget).toBeCloseTo(550, -2);
  });

  it('should apply surplus for gain goal', () => {
    const maintain = calculateTargets(baseInput);
    const gain = calculateTargets({
      ...baseInput,
      goalType: 'gain',
      weeklyRateKg: 0.3,
    });

    expect(gain.calorieTarget).toBeGreaterThan(maintain.calorieTarget);
  });

  it('should enforce minimum 1200 calories', () => {
    const result = calculateTargets({
      ...baseInput,
      goalType: 'lose_fat',
      weeklyRateKg: 1.5, // extreme deficit
      weightKg: 50,
      activityLevel: 'sedentary',
    });

    expect(result.calorieTarget).toBeGreaterThanOrEqual(1200);
  });

  it('should enforce protein minimum of 1.6 g/kg', () => {
    const result = calculateTargets(baseInput);
    expect(result.proteinGrams).toBeGreaterThanOrEqual(80 * 1.6);
  });

  it('should allocate fat as 25% of calories for standard diet', () => {
    const result = calculateTargets(baseInput);
    const fatCalories = result.fatGrams * 9;
    const fatPercent = fatCalories / result.calorieTarget;
    expect(fatPercent).toBeCloseTo(0.25, 1);
  });

  it('should fill remaining calories with carbs', () => {
    const result = calculateTargets(baseInput);
    const total = result.proteinGrams * 4 + result.carbsGrams * 4 + result.fatGrams * 9;
    // Should be close to calorie target (rounding differences)
    expect(Math.abs(total - result.calorieTarget)).toBeLessThan(10);
  });

  it('should vary with activity level', () => {
    const sedentary = calculateTargets({ ...baseInput, activityLevel: 'sedentary' });
    const active = calculateTargets({ ...baseInput, activityLevel: 'very_active' });
    expect(active.calorieTarget).toBeGreaterThan(sedentary.calorieTarget);
  });

  it('should produce stable outputs for identical inputs', () => {
    const a = calculateTargets(baseInput);
    const b = calculateTargets(baseInput);
    expect(a).toEqual(b);
  });
});
