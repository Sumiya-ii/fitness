/**
 * MET (Metabolic Equivalent of Task) values
 * Based on Ainsworth et al., 2011 Compendium of Physical Activities
 */

export interface WorkoutTypeInfo {
  key: string;
  met: number;
  category: string;
  label: { en: string; mn: string };
  icon: string;
}

const CATALOG: WorkoutTypeInfo[] = [
  // ── Running ──
  {
    key: 'running',
    met: 9.8,
    category: 'cardio',
    label: { en: 'Running', mn: 'Гүйлт' },
    icon: '🏃',
  },
  {
    key: 'running_slow',
    met: 7.0,
    category: 'cardio',
    label: { en: 'Jogging', mn: 'Аажим гүйлт' },
    icon: '🏃',
  },
  {
    key: 'running_fast',
    met: 12.3,
    category: 'cardio',
    label: { en: 'Sprinting', mn: 'Хурдан гүйлт' },
    icon: '🏃',
  },
  {
    key: 'treadmill',
    met: 9.8,
    category: 'cardio',
    label: { en: 'Treadmill', mn: 'Гүйдэг зам' },
    icon: '🏃',
  },

  // ── Walking ──
  {
    key: 'walking',
    met: 3.5,
    category: 'cardio',
    label: { en: 'Walking', mn: 'Алхалт' },
    icon: '🚶',
  },
  {
    key: 'walking_brisk',
    met: 4.3,
    category: 'cardio',
    label: { en: 'Brisk Walking', mn: 'Түргэн алхалт' },
    icon: '🚶',
  },
  {
    key: 'hiking',
    met: 5.3,
    category: 'cardio',
    label: { en: 'Hiking', mn: 'Уулын аялал' },
    icon: '🥾',
  },

  // ── Cycling ──
  {
    key: 'cycling',
    met: 7.5,
    category: 'cardio',
    label: { en: 'Cycling', mn: 'Дугуй унах' },
    icon: '🚴',
  },
  {
    key: 'cycling_stationary',
    met: 7.0,
    category: 'cardio',
    label: { en: 'Stationary Bike', mn: 'Суурин дугуй' },
    icon: '🚴',
  },
  {
    key: 'spinning',
    met: 8.5,
    category: 'cardio',
    label: { en: 'Spinning', mn: 'Спиннинг' },
    icon: '🚴',
  },

  // ── Swimming ──
  {
    key: 'swimming',
    met: 6.0,
    category: 'cardio',
    label: { en: 'Swimming', mn: 'Усанд сэлэлт' },
    icon: '🏊',
  },
  {
    key: 'swimming_laps',
    met: 8.0,
    category: 'cardio',
    label: { en: 'Lap Swimming', mn: 'Зайн сэлэлт' },
    icon: '🏊',
  },

  // ── Strength / Gym ──
  {
    key: 'weight_training',
    met: 3.5,
    category: 'strength',
    label: { en: 'Weight Training', mn: 'Хүндийн дасгал' },
    icon: '🏋️',
  },
  {
    key: 'strength_training',
    met: 5.0,
    category: 'strength',
    label: { en: 'Strength Training', mn: 'Хүч чадлын дасгал' },
    icon: '🏋️',
  },
  {
    key: 'powerlifting',
    met: 6.0,
    category: 'strength',
    label: { en: 'Powerlifting', mn: 'Пауэрлифтинг' },
    icon: '🏋️',
  },
  {
    key: 'bodyweight',
    met: 3.8,
    category: 'strength',
    label: { en: 'Bodyweight', mn: 'Биеийн жингийн дасгал' },
    icon: '💪',
  },
  {
    key: 'calisthenics',
    met: 4.0,
    category: 'strength',
    label: { en: 'Calisthenics', mn: 'Калистеникс' },
    icon: '💪',
  },
  {
    key: 'pull_ups',
    met: 8.0,
    category: 'strength',
    label: { en: 'Pull-ups', mn: 'Суга татах' },
    icon: '💪',
  },

  // ── HIIT / Cardio ──
  { key: 'hiit', met: 8.0, category: 'hiit', label: { en: 'HIIT', mn: 'HIIT' }, icon: '🔥' },
  {
    key: 'circuit_training',
    met: 8.0,
    category: 'hiit',
    label: { en: 'Circuit Training', mn: 'Тойрог дасгал' },
    icon: '🔥',
  },
  {
    key: 'crossfit',
    met: 8.5,
    category: 'hiit',
    label: { en: 'CrossFit', mn: 'Кроссфит' },
    icon: '🔥',
  },
  {
    key: 'aerobics',
    met: 6.5,
    category: 'cardio',
    label: { en: 'Aerobics', mn: 'Аэробик' },
    icon: '🤸',
  },
  {
    key: 'jump_rope',
    met: 11.0,
    category: 'hiit',
    label: { en: 'Jump Rope', mn: 'Дэлэнг үсрэх' },
    icon: '⏭️',
  },
  {
    key: 'elliptical',
    met: 5.0,
    category: 'cardio',
    label: { en: 'Elliptical', mn: 'Эллиптик' },
    icon: '🏃',
  },
  {
    key: 'rowing_machine',
    met: 7.0,
    category: 'cardio',
    label: { en: 'Rowing Machine', mn: 'Сэлүүрийн тренажёр' },
    icon: '🚣',
  },
  {
    key: 'stair_climbing',
    met: 9.0,
    category: 'cardio',
    label: { en: 'Stair Climbing', mn: 'Шат авирах' },
    icon: '🪜',
  },

  // ── Sports ──
  {
    key: 'basketball',
    met: 6.5,
    category: 'sports',
    label: { en: 'Basketball', mn: 'Сагсан бөмбөг' },
    icon: '🏀',
  },
  {
    key: 'football',
    met: 8.0,
    category: 'sports',
    label: { en: 'Football', mn: 'Хөл бөмбөг' },
    icon: '⚽',
  },
  {
    key: 'soccer',
    met: 7.0,
    category: 'sports',
    label: { en: 'Soccer', mn: 'Хөлбөмбөг' },
    icon: '⚽',
  },
  {
    key: 'volleyball',
    met: 4.0,
    category: 'sports',
    label: { en: 'Volleyball', mn: 'Волейбол' },
    icon: '🏐',
  },
  {
    key: 'tennis',
    met: 7.0,
    category: 'sports',
    label: { en: 'Tennis', mn: 'Теннис' },
    icon: '🎾',
  },
  {
    key: 'badminton',
    met: 5.5,
    category: 'sports',
    label: { en: 'Badminton', mn: 'Бадминтон' },
    icon: '🏸',
  },
  {
    key: 'table_tennis',
    met: 4.0,
    category: 'sports',
    label: { en: 'Table Tennis', mn: 'Ширээний теннис' },
    icon: '🏓',
  },
  { key: 'boxing', met: 12.0, category: 'sports', label: { en: 'Boxing', mn: 'Бокс' }, icon: '🥊' },
  {
    key: 'boxing_bag',
    met: 9.0,
    category: 'sports',
    label: { en: 'Boxing (Bag)', mn: 'Бокс (уут)' },
    icon: '🥊',
  },
  {
    key: 'martial_arts',
    met: 10.0,
    category: 'sports',
    label: { en: 'Martial Arts', mn: 'Тулааны урлаг' },
    icon: '🥋',
  },
  {
    key: 'wrestling',
    met: 8.0,
    category: 'sports',
    label: { en: 'Wrestling', mn: 'Бөх' },
    icon: '🤼',
  },
  {
    key: 'climbing',
    met: 8.0,
    category: 'sports',
    label: { en: 'Climbing', mn: 'Хадан авирах' },
    icon: '🧗',
  },

  // ── Mind-body ──
  { key: 'yoga', met: 3.0, category: 'flexibility', label: { en: 'Yoga', mn: 'Йог' }, icon: '🧘' },
  {
    key: 'pilates',
    met: 3.0,
    category: 'flexibility',
    label: { en: 'Pilates', mn: 'Пилатес' },
    icon: '🧘',
  },
  {
    key: 'stretching',
    met: 2.5,
    category: 'flexibility',
    label: { en: 'Stretching', mn: 'Сунгалт' },
    icon: '🙆',
  },
  {
    key: 'tai_chi',
    met: 3.0,
    category: 'flexibility',
    label: { en: 'Tai Chi', mn: 'Тай Чи' },
    icon: '🧘',
  },

  // ── Other ──
  {
    key: 'dancing',
    met: 5.0,
    category: 'cardio',
    label: { en: 'Dancing', mn: 'Бүжиг' },
    icon: '💃',
  },
  { key: 'zumba', met: 6.0, category: 'cardio', label: { en: 'Zumba', mn: 'Зумба' }, icon: '💃' },
  {
    key: 'ski',
    met: 7.0,
    category: 'sports',
    label: { en: 'Skiing', mn: 'Цанын спорт' },
    icon: '⛷️',
  },
  {
    key: 'ice_skating',
    met: 7.0,
    category: 'sports',
    label: { en: 'Ice Skating', mn: 'Мөсөн гулгалт' },
    icon: '⛸️',
  },
  {
    key: 'water_aerobics',
    met: 5.5,
    category: 'cardio',
    label: { en: 'Water Aerobics', mn: 'Усан аэробик' },
    icon: '🏊',
  },
];

// Fast lookup from key → info
const BY_KEY = new Map(CATALOG.map((t) => [t.key, t]));

// Build a simple met-only lookup (for backward compat + fast calc)
const MET_TABLE = Object.fromEntries(CATALOG.map((t) => [t.key, t.met]));

const DEFAULT_MET = 5.0;

export function getMetValue(workoutType: string): number {
  const key = workoutType.toLowerCase().replace(/[\s-]/g, '_');
  return MET_TABLE[key] ?? DEFAULT_MET;
}

/**
 * Calories = MET x weight_kg x (duration_min / 60)
 * Returns 0 if duration or weight are missing.
 */
export function calculateCaloriesBurned(
  workoutType: string,
  durationMin: number,
  weightKg: number,
): number {
  if (durationMin <= 0 || weightKg <= 0) return 0;
  const met = getMetValue(workoutType);
  return Math.round(met * weightKg * (durationMin / 60));
}

/** Lookup display info for a workoutType key. Returns null for custom/unknown types. */
export function getWorkoutTypeInfo(workoutType: string): WorkoutTypeInfo | null {
  const key = workoutType.toLowerCase().replace(/[\s-]/g, '_');
  return BY_KEY.get(key) ?? null;
}

/** Full catalog grouped by category for the mobile picker. */
export function getWorkoutCatalog(): Record<string, WorkoutTypeInfo[]> {
  const grouped: Record<string, WorkoutTypeInfo[]> = {};
  for (const item of CATALOG) {
    (grouped[item.category] ??= []).push(item);
  }
  return grouped;
}

/** Flat catalog list. */
export function getWorkoutTypeList(): WorkoutTypeInfo[] {
  return [...CATALOG];
}

export const WORKOUT_TYPES = Object.keys(MET_TABLE) as [string, ...string[]];
