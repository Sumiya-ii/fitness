import { create } from 'zustand';

export type GoalType = 'lose' | 'maintain' | 'gain';
export type Gender = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export interface ProfileData {
  goal: GoalType;
  gender: Gender;
  dateOfBirth: Date;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
}

export interface CalculatedTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

// Mifflin-St Jeor BMR formula
function calculateBMR(gender: Gender, weightKg: number, heightCm: number, age: number): number {
  if (gender === 'male') {
    return 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  }
  return 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
}

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export function calculateTargets(profile: ProfileData): CalculatedTargets {
  const age = Math.floor(
    (Date.now() - profile.dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  );
  const bmr = calculateBMR(profile.gender, profile.weightKg, profile.heightCm, age);
  const tdee = bmr * ACTIVITY_MULTIPLIERS[profile.activityLevel];

  let calories: number;
  switch (profile.goal) {
    case 'lose':
      calories = tdee - 500; // ~0.5kg/week
      break;
    case 'gain':
      calories = tdee + 300; // ~0.3kg/week
      break;
    default:
      calories = tdee;
  }

  const protein = Math.round(profile.weightKg * 2); // 2g per kg
  const fat = Math.round((calories * 0.25) / 9); // 25% from fat
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);

  return {
    calories: Math.round(calories),
    protein,
    carbs: Math.max(0, carbs),
    fat,
  };
}

interface ProfileState extends Partial<ProfileData> {
  setGoal: (goal: GoalType) => void;
  setProfile: (data: Partial<ProfileData>) => void;
  getProfile: () => ProfileData | null;
  getTargets: () => CalculatedTargets | null;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  setGoal: (goal) => set({ goal }),
  setProfile: (data) => set(data),
  getProfile: () => {
    const s = get();
    if (
      s.goal &&
      s.gender &&
      s.dateOfBirth &&
      s.heightCm &&
      s.weightKg &&
      s.activityLevel
    ) {
      return {
        goal: s.goal,
        gender: s.gender,
        dateOfBirth: s.dateOfBirth,
        heightCm: s.heightCm,
        weightKg: s.weightKg,
        activityLevel: s.activityLevel,
      };
    }
    return null;
  },
  getTargets: () => {
    const profile = get().getProfile();
    return profile ? calculateTargets(profile) : null;
  },
}));
