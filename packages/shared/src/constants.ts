export const APP_NAME = 'Coach';

export const SUPPORTED_LOCALES = ['mn', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'mn';

export const UNIT_SYSTEMS = ['metric', 'imperial'] as const;
export type UnitSystem = (typeof UNIT_SYSTEMS)[number];

export const DEFAULT_UNIT_SYSTEM: UnitSystem = 'metric';

export const GOAL_TYPES = ['lose_fat', 'maintain', 'gain'] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

export const API_VERSION = 'v1';
export const API_PREFIX = `/api/${API_VERSION}`;
