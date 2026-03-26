import {
  calculateBmiDetailed,
  classifyBmi,
  calculateNavyBodyFat,
  classifyBodyFat,
  calculateWeeklyBudget,
} from './body-composition.calculator';

describe('BMI calculations', () => {
  it('calculates standard BMI correctly', () => {
    // 80kg, 180cm → BMI = 80 / 1.8² = 24.7
    const result = calculateBmiDetailed(180, 80);
    expect(result).not.toBeNull();
    expect(result!.standard).toBe(24.7);
    expect(result!.category).toBe('normal');
  });

  it('calculates Trefethen BMI correctly', () => {
    // 1.3 × 80 / 1.8^2.5 = 1.3 × 80 / 4.3449 ≈ 23.9
    const result = calculateBmiDetailed(180, 80);
    expect(result).not.toBeNull();
    expect(result!.trefethen).toBe(23.9);
  });

  it('calculates BMI Prime correctly', () => {
    const result = calculateBmiDetailed(180, 80);
    expect(result).not.toBeNull();
    // 24.7 / 25 = 0.99
    expect(result!.bmiPrime).toBe(0.99);
  });

  it('returns null for invalid inputs', () => {
    expect(calculateBmiDetailed(0, 80)).toBeNull();
    expect(calculateBmiDetailed(180, 0)).toBeNull();
    expect(calculateBmiDetailed(-10, 80)).toBeNull();
  });

  it('classifies BMI correctly across all categories', () => {
    expect(classifyBmi(16)).toBe('underweight');
    expect(classifyBmi(22)).toBe('normal');
    expect(classifyBmi(27)).toBe('overweight');
    expect(classifyBmi(32)).toBe('obese_class_1');
    expect(classifyBmi(37)).toBe('obese_class_2');
    expect(classifyBmi(42)).toBe('obese_class_3');
  });

  it('handles boundary values correctly', () => {
    expect(classifyBmi(18.5)).toBe('normal');
    expect(classifyBmi(25)).toBe('overweight');
    expect(classifyBmi(30)).toBe('obese_class_1');
    expect(classifyBmi(35)).toBe('obese_class_2');
    expect(classifyBmi(40)).toBe('obese_class_3');
  });

  it('handles short person — Trefethen shows higher BMI than standard', () => {
    // 152cm (5'0"), 65kg
    const result = calculateBmiDetailed(152, 65);
    expect(result).not.toBeNull();
    // Trefethen should be higher for short people
    expect(result!.trefethen).toBeGreaterThan(result!.standard);
  });

  it('handles tall person — Trefethen shows lower BMI than standard', () => {
    // 195cm (6'5"), 90kg
    const result = calculateBmiDetailed(195, 90);
    expect(result).not.toBeNull();
    // Trefethen should be lower for tall people
    expect(result!.trefethen).toBeLessThan(result!.standard);
  });
});

describe('US Navy body fat calculation', () => {
  it('calculates male body fat correctly', () => {
    // Typical male: 180cm, 85cm waist, 38cm neck, 80kg
    const result = calculateNavyBodyFat({
      gender: 'male',
      heightCm: 180,
      waistCm: 85,
      neckCm: 38,
      weightKg: 80,
    });
    expect(result).not.toBeNull();
    // Expected: ~17-20% for these measurements
    expect(result!.bodyFatPercent).toBeGreaterThan(10);
    expect(result!.bodyFatPercent).toBeLessThan(30);
    expect(result!.fatMassKg).toBeGreaterThan(0);
    expect(result!.leanMassKg).toBeGreaterThan(0);
    expect(result!.fatMassKg + result!.leanMassKg).toBeCloseTo(80, 0);
  });

  it('calculates female body fat correctly', () => {
    // Typical female: 165cm, 72cm waist, 32cm neck, 95cm hip, 62kg
    const result = calculateNavyBodyFat({
      gender: 'female',
      heightCm: 165,
      waistCm: 72,
      neckCm: 32,
      hipCm: 95,
      weightKg: 62,
    });
    expect(result).not.toBeNull();
    // Expected: ~25-35% for these measurements
    expect(result!.bodyFatPercent).toBeGreaterThan(15);
    expect(result!.bodyFatPercent).toBeLessThan(45);
    expect(result!.fatMassKg + result!.leanMassKg).toBeCloseTo(62, 0);
  });

  it('returns null for female without hip measurement', () => {
    const result = calculateNavyBodyFat({
      gender: 'female',
      heightCm: 165,
      waistCm: 72,
      neckCm: 32,
      weightKg: 62,
    });
    expect(result).toBeNull();
  });

  it('returns null when waist <= neck for male', () => {
    const result = calculateNavyBodyFat({
      gender: 'male',
      heightCm: 180,
      waistCm: 35,
      neckCm: 40,
      weightKg: 80,
    });
    expect(result).toBeNull();
  });

  it('returns null for zero/negative inputs', () => {
    expect(
      calculateNavyBodyFat({
        gender: 'male',
        heightCm: 0,
        waistCm: 85,
        neckCm: 38,
        weightKg: 80,
      }),
    ).toBeNull();
  });

  it('includes BMI in results', () => {
    const result = calculateNavyBodyFat({
      gender: 'male',
      heightCm: 180,
      waistCm: 85,
      neckCm: 38,
      weightKg: 80,
    });
    expect(result).not.toBeNull();
    expect(result!.bmi.standard).toBe(24.7);
    expect(result!.bmi.category).toBe('normal');
  });

  it('clamps body fat to reasonable range', () => {
    // Very lean male — should not go below 2%
    const result = calculateNavyBodyFat({
      gender: 'male',
      heightCm: 180,
      waistCm: 70,
      neckCm: 42,
      weightKg: 80,
    });
    if (result) {
      expect(result.bodyFatPercent).toBeGreaterThanOrEqual(2);
      expect(result.bodyFatPercent).toBeLessThanOrEqual(60);
    }
  });
});

describe('Body fat classification (ACE)', () => {
  it('classifies male body fat correctly', () => {
    expect(classifyBodyFat(4, 'male')).toBe('essential');
    expect(classifyBodyFat(10, 'male')).toBe('athletic');
    expect(classifyBodyFat(16, 'male')).toBe('fitness');
    expect(classifyBodyFat(20, 'male')).toBe('average');
    expect(classifyBodyFat(30, 'male')).toBe('obese');
  });

  it('classifies female body fat correctly', () => {
    expect(classifyBodyFat(12, 'female')).toBe('essential');
    expect(classifyBodyFat(18, 'female')).toBe('athletic');
    expect(classifyBodyFat(23, 'female')).toBe('fitness');
    expect(classifyBodyFat(28, 'female')).toBe('average');
    expect(classifyBodyFat(35, 'female')).toBe('obese');
  });
});

describe('Weekly calorie budget (rollover)', () => {
  it('calculates weekly budget with no entries', () => {
    const result = calculateWeeklyBudget(2000, [], '2026-03-25'); // Wednesday
    expect(result.weeklyBudget).toBe(14000);
    expect(result.totalConsumed).toBe(0);
    expect(result.remaining).toBe(14000);
    expect(result.days).toHaveLength(7);
  });

  it('calculates rollover correctly with partial week', () => {
    // Monday target: 2000/day, 14000/week
    // Mon: 1500, Tue: 1800, Wed (today): 0
    const entries = [
      { date: '2026-03-23', consumed: 1500 },
      { date: '2026-03-24', consumed: 1800 },
    ];
    const result = calculateWeeklyBudget(2000, entries, '2026-03-25'); // Wednesday

    expect(result.weeklyBudget).toBe(14000);
    expect(result.totalConsumed).toBe(3300);
    expect(result.remaining).toBe(10700);
    // Remaining 5 days (Wed-Sun): 10700 / 5 = 2140
    expect(result.adjustedDailyTarget).toBe(2140);
  });

  it('correctly identifies Monday as week start', () => {
    const result = calculateWeeklyBudget(2000, [], '2026-03-23'); // Monday
    expect(result.weekStart).toBe('2026-03-23');
    expect(result.weekEnd).toBe('2026-03-29');
  });

  it('handles Sunday correctly', () => {
    const result = calculateWeeklyBudget(2000, [], '2026-03-29'); // Sunday
    expect(result.weekStart).toBe('2026-03-23');
    expect(result.weekEnd).toBe('2026-03-29');
    // Only 1 remaining day (Sunday itself)
    expect(result.adjustedDailyTarget).toBe(14000);
  });

  it('calculates daily deltas correctly', () => {
    const entries = [{ date: '2026-03-23', consumed: 2500 }];
    const result = calculateWeeklyBudget(2000, entries, '2026-03-23');

    const monday = result.days.find((d) => d.date === '2026-03-23');
    expect(monday).toBeDefined();
    expect(monday!.delta).toBe(500); // over target
  });

  it('handles over-budget scenario', () => {
    // All 7 days at 2500 = 17500, budget = 14000
    const entries = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-03-${23 + i}`,
      consumed: 2500,
    }));
    const result = calculateWeeklyBudget(2000, entries, '2026-03-29');
    expect(result.remaining).toBe(-3500);
  });
});
