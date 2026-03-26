import { create } from 'zustand';
import type { GoalType, Gender, ActivityLevel, DietPreference } from '@coach/shared';

export type { GoalType, Gender, ActivityLevel, DietPreference };

export interface OnboardingData {
  goalType: GoalType | null;
  goalWeightKg: number | null;
  weeklyRateKg: number | null;
  gender: Gender | null;
  birthDate: Date | null;
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: ActivityLevel | null;
  dietPreference: DietPreference | null;
}

export interface CalculatedTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extra_active: 1.9,
};

function calculateBMR(gender: Gender, weightKg: number, heightCm: number, age: number): number {
  if (gender === 'female') {
    return 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  }
  if (gender === 'other') {
    // Use average of male and female Mifflin-St Jeor formulas
    const male = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
    const female = 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
    return (male + female) / 2;
  }
  return 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
}

function getMacroRatios(pref: DietPreference): {
  proteinRatio: number;
  fatRatio: number;
} {
  switch (pref) {
    case 'high_protein':
      return { proteinRatio: 0.4, fatRatio: 0.25 };
    case 'low_carb':
      return { proteinRatio: 0.3, fatRatio: 0.4 };
    case 'low_fat':
      return { proteinRatio: 0.3, fatRatio: 0.15 };
    case 'standard':
    default:
      return { proteinRatio: 0.3, fatRatio: 0.25 };
  }
}

export function calculateTargets(data: OnboardingData): CalculatedTargets | null {
  const {
    goalType,
    weeklyRateKg,
    gender,
    birthDate,
    heightCm,
    weightKg,
    activityLevel,
    dietPreference,
  } = data;

  if (
    !goalType ||
    weeklyRateKg == null ||
    !gender ||
    !birthDate ||
    !heightCm ||
    !weightKg ||
    !activityLevel ||
    !dietPreference
  ) {
    return null;
  }

  const age = Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  const bmr = calculateBMR(gender, weightKg, heightCm, age);
  const tdee = bmr * ACTIVITY_MULTIPLIERS[activityLevel];

  let calories: number;
  if (goalType === 'lose_fat') {
    calories = tdee - (weeklyRateKg * 7700) / 7;
  } else if (goalType === 'gain') {
    calories = tdee + (weeklyRateKg * 7700) / 7;
  } else {
    calories = tdee;
  }
  calories = Math.max(1200, Math.round(calories));

  const { proteinRatio, fatRatio } = getMacroRatios(dietPreference);
  const protein = Math.round(Math.max(weightKg * 1.6, (calories * proteinRatio) / 4));
  const fat = Math.round((calories * fatRatio) / 9);
  const remaining = Math.max(0, calories - protein * 4 - fat * 9);
  const carbs = Math.round(remaining / 4);

  return { calories, protein, carbs, fat };
}

interface ProfileState extends OnboardingData {
  setGoalType: (goal: GoalType) => void;
  setGoalWeightKg: (weight: number) => void;
  setWeeklyRateKg: (rate: number) => void;
  setGender: (gender: Gender) => void;
  setBirthDate: (date: Date) => void;
  setHeightCm: (height: number) => void;
  setWeightKg: (weight: number) => void;
  setActivityLevel: (level: ActivityLevel) => void;
  setDietPreference: (pref: DietPreference) => void;
  getOnboardingData: () => OnboardingData;
  getTargets: () => CalculatedTargets | null;
  isComplete: () => boolean;
  reset: () => void;
}

const initialState: OnboardingData = {
  goalType: null,
  goalWeightKg: null,
  weeklyRateKg: null,
  gender: null,
  birthDate: null,
  heightCm: null,
  weightKg: null,
  activityLevel: null,
  dietPreference: null,
};

export const useProfileStore = create<ProfileState>((set, get) => ({
  ...initialState,

  setGoalType: (goalType) => set({ goalType }),
  setGoalWeightKg: (goalWeightKg) => set({ goalWeightKg }),
  setWeeklyRateKg: (weeklyRateKg) => set({ weeklyRateKg }),
  setGender: (gender) => set({ gender }),
  setBirthDate: (birthDate) => set({ birthDate }),
  setHeightCm: (heightCm) => set({ heightCm }),
  setWeightKg: (weightKg) => set({ weightKg }),
  setActivityLevel: (activityLevel) => set({ activityLevel }),
  setDietPreference: (dietPreference) => set({ dietPreference }),

  getOnboardingData: () => {
    const s = get();
    return {
      goalType: s.goalType,
      goalWeightKg: s.goalWeightKg,
      weeklyRateKg: s.weeklyRateKg,
      gender: s.gender,
      birthDate: s.birthDate,
      heightCm: s.heightCm,
      weightKg: s.weightKg,
      activityLevel: s.activityLevel,
      dietPreference: s.dietPreference,
    };
  },

  getTargets: () => calculateTargets(get().getOnboardingData()),

  isComplete: () => {
    const d = get().getOnboardingData();
    return !!(
      d.goalType &&
      d.goalWeightKg &&
      d.weeklyRateKg != null &&
      d.gender &&
      d.birthDate &&
      d.heightCm &&
      d.weightKg &&
      d.activityLevel &&
      d.dietPreference
    );
  },

  reset: () => set(initialState),
}));
