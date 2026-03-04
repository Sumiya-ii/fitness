import { calculateTargets, CalcInput } from './target-calculator';

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

  it('should allocate fat as 20% of calories', () => {
    const result = calculateTargets(baseInput);
    const fatCalories = result.fatGrams * 9;
    const fatPercent = fatCalories / result.calorieTarget;
    expect(fatPercent).toBeCloseTo(0.2, 1);
  });

  it('should fill remaining calories with carbs', () => {
    const result = calculateTargets(baseInput);
    const total =
      result.proteinGrams * 4 + result.carbsGrams * 4 + result.fatGrams * 9;
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
