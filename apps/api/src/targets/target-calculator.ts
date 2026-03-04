import { GoalType } from '@coach/shared';

export interface CalcInput {
  gender: string;
  birthDate: string; // YYYY-MM-DD
  heightCm: number;
  weightKg: number;
  activityLevel: string;
  goalType: GoalType;
  weeklyRateKg: number;
}

export interface CalcResult {
  tdee: number;
  calorieTarget: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
}

const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extra_active: 1.9,
};

/**
 * Mifflin-St Jeor BMR equation (widely accepted for calorie estimation).
 */
function calculateBMR(gender: string, weightKg: number, heightCm: number, ageYears: number): number {
  if (gender === 'female') {
    return 10 * weightKg + 6.25 * heightCm - 5 * ageYears - 161;
  }
  return 10 * weightKg + 6.25 * heightCm - 5 * ageYears + 5;
}

function getAgeYears(birthDate: string): number {
  const birth = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

const PROTEIN_MIN_G_PER_KG = 1.6;
const FAT_MIN_PERCENT = 0.2;
const KCAL_PER_KG_FAT = 7700;

/**
 * Calculate calorie and macro targets based on user profile and goal.
 *
 * Formula:
 *   1. BMR via Mifflin-St Jeor
 *   2. TDEE = BMR × activity multiplier
 *   3. calorie_target = TDEE + weekly_adjustment / 7
 *      - lose_fat: deficit = weeklyRateKg × 7700 / 7
 *      - gain: surplus = weeklyRateKg × 7700 / 7
 *      - maintain: 0
 *   4. Protein = max(bodyweight × 1.6 g/kg, floor from calorie target)
 *   5. Fat = 20% of calorie target
 *   6. Carbs = remainder
 */
export function calculateTargets(input: CalcInput): CalcResult {
  const age = getAgeYears(input.birthDate);
  const bmr = calculateBMR(input.gender, input.weightKg, input.heightCm, age);
  const multiplier = ACTIVITY_MULTIPLIERS[input.activityLevel] ?? 1.55;
  const tdee = Math.round(bmr * multiplier);

  let dailyAdjustment = 0;
  if (input.goalType === 'lose_fat') {
    dailyAdjustment = -(input.weeklyRateKg * KCAL_PER_KG_FAT) / 7;
  } else if (input.goalType === 'gain') {
    dailyAdjustment = (input.weeklyRateKg * KCAL_PER_KG_FAT) / 7;
  }

  const calorieTarget = Math.max(1200, Math.round(tdee + dailyAdjustment));

  const proteinGrams = Math.round(Math.max(input.weightKg * PROTEIN_MIN_G_PER_KG));
  const fatGrams = Math.round((calorieTarget * FAT_MIN_PERCENT) / 9);

  const proteinCalories = proteinGrams * 4;
  const fatCalories = fatGrams * 9;
  const remainingCalories = Math.max(0, calorieTarget - proteinCalories - fatCalories);
  const carbsGrams = Math.round(remainingCalories / 4);

  return {
    tdee,
    calorieTarget,
    proteinGrams,
    carbsGrams,
    fatGrams,
  };
}
