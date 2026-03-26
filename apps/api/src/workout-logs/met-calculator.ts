/**
 * MET (Metabolic Equivalent of Task) values
 * Based on Ainsworth et al., 2011 Compendium of Physical Activities
 */
const MET_TABLE: Record<string, number> = {
  // Running
  running: 9.8,
  running_slow: 7.0,
  running_moderate: 9.8,
  running_fast: 12.3,
  jogging: 7.0,
  treadmill: 9.8,

  // Walking
  walking: 3.5,
  walking_slow: 2.5,
  walking_brisk: 4.3,
  hiking: 5.3,

  // Cycling
  cycling: 7.5,
  cycling_outdoor: 8.0,
  cycling_stationary: 7.0,
  spinning: 8.5,

  // Swimming
  swimming: 6.0,
  swimming_laps: 8.0,
  water_aerobics: 5.5,

  // Strength / Gym
  weight_training: 3.5,
  strength_training: 5.0,
  powerlifting: 6.0,
  bodyweight: 3.8,
  calisthenics: 4.0,
  pull_ups: 8.0,

  // HIIT / Cardio
  hiit: 8.0,
  circuit_training: 8.0,
  aerobics: 6.5,
  jump_rope: 11.0,
  elliptical: 5.0,
  rowing_machine: 7.0,
  stair_climbing: 9.0,
  stair_machine: 9.0,

  // Sports
  basketball: 6.5,
  football: 8.0,
  soccer: 7.0,
  volleyball: 4.0,
  tennis: 7.0,
  badminton: 5.5,
  table_tennis: 4.0,
  boxing: 12.0,
  boxing_bag: 9.0,
  martial_arts: 10.0,
  wrestling: 8.0,
  crossfit: 8.5,
  climbing: 8.0,

  // Mind-body
  yoga: 3.0,
  pilates: 3.0,
  stretching: 2.5,
  tai_chi: 3.0,

  // Other
  dancing: 5.0,
  zumba: 6.0,
  jump_training: 8.0,
  ski: 7.0,
  ice_skating: 7.0,
};

const DEFAULT_MET = 5.0;

export function getMetValue(workoutType: string): number {
  const key = workoutType.toLowerCase().replace(/[\s-]/g, '_');
  return MET_TABLE[key] ?? DEFAULT_MET;
}

/**
 * Calories = MET × weight_kg × (duration_min / 60)
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

export const WORKOUT_TYPES = Object.keys(MET_TABLE) as [string, ...string[]];
