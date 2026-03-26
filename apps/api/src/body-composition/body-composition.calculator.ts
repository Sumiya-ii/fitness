/**
 * Body composition calculations:
 *   - BMI (standard WHO + Trefethen "new BMI")
 *   - US Navy body fat % (circumference-based)
 *   - Derived: fat mass, lean mass, BMI category
 *
 * References:
 *   WHO BMI classification: https://www.who.int/data/gho/data/themes/topics/topic-details/GHO/body-mass-index
 *   Trefethen (2013): https://people.maths.ox.ac.uk/trefethen/bmi.html
 *   US Navy body fat: Hodgdon & Beckett, NHRC San Diego (1984)
 */

// ─── BMI ──────────────────────────────────────────────────────────────────────

export type BmiCategory =
  | 'underweight'
  | 'normal'
  | 'overweight'
  | 'obese_class_1'
  | 'obese_class_2'
  | 'obese_class_3';

export interface BmiResult {
  /** Standard WHO BMI = kg / m² */
  standard: number;
  /** Trefethen "new BMI" = 1.3 × kg / m^2.5 — better for very tall/short individuals */
  trefethen: number;
  /** BMI Prime = BMI / 25 (optimal upper bound) */
  bmiPrime: number;
  /** WHO classification based on standard BMI */
  category: BmiCategory;
}

export function classifyBmi(bmi: number): BmiCategory {
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25) return 'normal';
  if (bmi < 30) return 'overweight';
  if (bmi < 35) return 'obese_class_1';
  if (bmi < 40) return 'obese_class_2';
  return 'obese_class_3';
}

export function calculateBmiDetailed(heightCm: number, weightKg: number): BmiResult | null {
  if (heightCm <= 0 || weightKg <= 0) return null;

  const heightM = heightCm / 100;
  const standard = Number((weightKg / (heightM * heightM)).toFixed(1));
  const trefethen = Number((1.3 * (weightKg / Math.pow(heightM, 2.5))).toFixed(1));
  const bmiPrime = Number((standard / 25).toFixed(2));

  return {
    standard,
    trefethen,
    bmiPrime,
    category: classifyBmi(standard),
  };
}

// ─── US Navy Body Fat ─────────────────────────────────────────────────────────

export interface NavyBodyFatInput {
  gender: 'male' | 'female';
  heightCm: number;
  waistCm: number;
  neckCm: number;
  /** Required for female; ignored for male */
  hipCm?: number;
  weightKg: number;
}

export interface BodyCompositionResult {
  bodyFatPercent: number;
  fatMassKg: number;
  leanMassKg: number;
  bmi: BmiResult;
}

/**
 * US Navy body fat % formula.
 *
 * Male:
 *   BF% = 86.010 × log₁₀(waist − neck) − 70.041 × log₁₀(height) + 36.76
 *
 * Female:
 *   BF% = 163.205 × log₁₀(waist + hip − neck) − 97.684 × log₁₀(height) − 78.387
 *
 * All measurements in cm (converted to inches internally).
 */
export function calculateNavyBodyFat(input: NavyBodyFatInput): BodyCompositionResult | null {
  const { gender, heightCm, waistCm, neckCm, hipCm, weightKg } = input;

  if (heightCm <= 0 || waistCm <= 0 || neckCm <= 0 || weightKg <= 0) return null;
  if (gender === 'female' && (hipCm == null || hipCm <= 0)) return null;

  // Convert cm to inches
  const CM_TO_IN = 0.393701;
  const heightIn = heightCm * CM_TO_IN;
  const waistIn = waistCm * CM_TO_IN;
  const neckIn = neckCm * CM_TO_IN;
  const hipIn = hipCm ? hipCm * CM_TO_IN : 0;

  let bodyFatPercent: number;

  if (gender === 'male') {
    // Guard: waist must be greater than neck
    if (waistIn <= neckIn) return null;
    bodyFatPercent = 86.01 * Math.log10(waistIn - neckIn) - 70.041 * Math.log10(heightIn) + 36.76;
  } else {
    // Guard: waist + hip must be greater than neck
    if (waistIn + hipIn <= neckIn) return null;
    bodyFatPercent =
      163.205 * Math.log10(waistIn + hipIn - neckIn) - 97.684 * Math.log10(heightIn) - 78.387;
  }

  // Clamp to reasonable range [2, 60]
  bodyFatPercent = Math.max(2, Math.min(60, bodyFatPercent));
  bodyFatPercent = Number(bodyFatPercent.toFixed(1));

  const fatMassKg = Number(((bodyFatPercent / 100) * weightKg).toFixed(1));
  const leanMassKg = Number((weightKg - fatMassKg).toFixed(1));

  const bmi = calculateBmiDetailed(heightCm, weightKg);
  if (!bmi) return null;

  return {
    bodyFatPercent,
    fatMassKg,
    leanMassKg,
    bmi,
  };
}

// ─── Body fat category ────────────────────────────────────────────────────────

export type BodyFatCategory = 'essential' | 'athletic' | 'fitness' | 'average' | 'obese';

/**
 * ACE (American Council on Exercise) body fat classification.
 */
export function classifyBodyFat(
  bodyFatPercent: number,
  gender: 'male' | 'female',
): BodyFatCategory {
  if (gender === 'male') {
    if (bodyFatPercent < 6) return 'essential';
    if (bodyFatPercent < 14) return 'athletic';
    if (bodyFatPercent < 18) return 'fitness';
    if (bodyFatPercent < 25) return 'average';
    return 'obese';
  }
  // female
  if (bodyFatPercent < 14) return 'essential';
  if (bodyFatPercent < 21) return 'athletic';
  if (bodyFatPercent < 25) return 'fitness';
  if (bodyFatPercent < 32) return 'average';
  return 'obese';
}

// ─── Rollover / Weekly Calorie Budget ─────────────────────────────────────────

export interface DailyCalorieEntry {
  date: string;
  consumed: number;
}

export interface WeeklyBudgetResult {
  weekStart: string;
  weekEnd: string;
  dailyTarget: number;
  weeklyBudget: number;
  totalConsumed: number;
  remaining: number;
  days: {
    date: string;
    target: number;
    consumed: number;
    delta: number; // positive = surplus, negative = deficit
  }[];
  /** Adjusted daily target for remaining days to stay on budget */
  adjustedDailyTarget: number | null;
}

/**
 * Calculate weekly calorie budget with rollover.
 *
 * If the user under-eats on some days, the remaining budget rolls over
 * to the remaining days of the week (Monday-based ISO week).
 */
export function calculateWeeklyBudget(
  dailyTarget: number,
  entries: DailyCalorieEntry[],
  today: string,
): WeeklyBudgetResult {
  // Find Monday of the week containing `today`
  const todayDate = new Date(today + 'T12:00:00Z');
  const dayOfWeek = (todayDate.getUTCDay() + 6) % 7; // Mon=0, Sun=6
  const mondayDate = new Date(todayDate);
  mondayDate.setUTCDate(todayDate.getUTCDate() - dayOfWeek);
  const weekStart = mondayDate.toISOString().split('T')[0]!;

  const sundayDate = new Date(mondayDate);
  sundayDate.setUTCDate(mondayDate.getUTCDate() + 6);
  const weekEnd = sundayDate.toISOString().split('T')[0]!;

  const weeklyBudget = dailyTarget * 7;
  const entryMap = new Map(entries.map((e) => [e.date, e.consumed]));

  const days: WeeklyBudgetResult['days'] = [];
  let totalConsumed = 0;

  for (let i = 0; i < 7; i++) {
    const d = new Date(mondayDate);
    d.setUTCDate(mondayDate.getUTCDate() + i);
    const dateStr = d.toISOString().split('T')[0]!;
    const consumed = entryMap.get(dateStr) ?? 0;
    totalConsumed += consumed;

    days.push({
      date: dateStr,
      target: dailyTarget,
      consumed,
      delta: consumed - dailyTarget,
    });
  }

  const remaining = weeklyBudget - totalConsumed;

  // Calculate adjusted target for remaining days (today + future days in week)
  const todayIdx = dayOfWeek;
  const remainingDays = 7 - todayIdx; // includes today
  const adjustedDailyTarget = remainingDays > 0 ? Math.round(remaining / remainingDays) : null;

  return {
    weekStart,
    weekEnd,
    dailyTarget,
    weeklyBudget,
    totalConsumed,
    remaining,
    days,
    adjustedDailyTarget,
  };
}
