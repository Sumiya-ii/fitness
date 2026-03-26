export const APP_NAME = 'Coach';

export const SUPPORTED_LOCALES = ['mn', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'mn';

export const UNIT_SYSTEMS = ['metric', 'imperial'] as const;
export type UnitSystem = (typeof UNIT_SYSTEMS)[number];

export const DEFAULT_UNIT_SYSTEM: UnitSystem = 'metric';

export const GOAL_TYPES = ['lose_fat', 'maintain', 'gain'] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

export const GENDERS = ['male', 'female', 'other'] as const;
export type Gender = (typeof GENDERS)[number];

export const ACTIVITY_LEVELS = [
  'sedentary',
  'lightly_active',
  'moderately_active',
  'very_active',
  'extra_active',
] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

export const DIET_PREFERENCES = ['standard', 'high_protein', 'low_carb', 'low_fat'] as const;
export type DietPreference = (typeof DIET_PREFERENCES)[number];

export const API_VERSION = 'v1';
export const API_PREFIX = `/api/${API_VERSION}`;
