import type { UnitSystem } from '@coach/shared';

// ─── Conversion constants ────────────────────────────────────────────────────

const KG_TO_LBS = 2.20462;
const CM_TO_IN = 0.393701;
const CM_PER_FOOT = 30.48;
const CM_PER_INCH = 2.54;

// ─── Weight conversions ──────────────────────────────────────────────────────

/** Convert kg to the display unit. Returns rounded value. */
export function displayWeight(kg: number, unit: UnitSystem, decimals = 1): number {
  if (unit === 'imperial') {
    return Number((kg * KG_TO_LBS).toFixed(decimals));
  }
  return Number(kg.toFixed(decimals));
}

/** Convert user input (in display unit) back to kg for storage. */
export function inputToKg(value: number, unit: UnitSystem): number {
  if (unit === 'imperial') {
    return Number((value / KG_TO_LBS).toFixed(2));
  }
  return value;
}

/** Weight unit label */
export function weightUnit(unit: UnitSystem): string {
  return unit === 'imperial' ? 'lbs' : 'kg';
}

/** Weekly rate unit label */
export function weeklyRateUnit(unit: UnitSystem): string {
  return unit === 'imperial' ? 'lbs/week' : 'kg/week';
}

/** Display a weekly rate value in the user's unit */
export function displayWeeklyRate(kgPerWeek: number, unit: UnitSystem): string {
  if (unit === 'imperial') {
    return (kgPerWeek * KG_TO_LBS).toFixed(1);
  }
  return kgPerWeek.toFixed(2);
}

// ─── Height conversions ──────────────────────────────────────────────────────

/** Convert cm to feet and inches */
export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = cm * CM_TO_IN;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  // Handle rounding to 12 inches
  if (inches === 12) {
    return { feet: feet + 1, inches: 0 };
  }
  return { feet, inches };
}

/** Convert feet + inches to cm */
export function feetInchesToCm(feet: number, inches: number): number {
  return Math.round(feet * CM_PER_FOOT + inches * CM_PER_INCH);
}

/** Display height in user's preferred unit */
export function displayHeight(cm: number, unit: UnitSystem): string {
  if (unit === 'imperial') {
    const { feet, inches } = cmToFeetInches(cm);
    return `${feet}'${inches}"`;
  }
  return `${cm} cm`;
}

/** Height unit label */
export function heightUnit(unit: UnitSystem): string {
  return unit === 'imperial' ? 'ft/in' : 'cm';
}

// ─── Body measurement conversions ────────────────────────────────────────────

/** Convert cm to inches for display */
export function displayMeasurement(cm: number, unit: UnitSystem, decimals = 1): number {
  if (unit === 'imperial') {
    return Number((cm * CM_TO_IN).toFixed(decimals));
  }
  return Number(cm.toFixed(decimals));
}

/** Convert user input back to cm */
export function inputToCm(value: number, unit: UnitSystem): number {
  if (unit === 'imperial') {
    return Number((value / CM_TO_IN).toFixed(1));
  }
  return value;
}

/** Body measurement unit label */
export function measurementUnit(unit: UnitSystem): string {
  return unit === 'imperial' ? 'in' : 'cm';
}

// ─── Validation ranges (in display units) ────────────────────────────────────

export function weightRange(unit: UnitSystem): { min: number; max: number; placeholder: string } {
  if (unit === 'imperial') {
    return { min: 44, max: 1100, placeholder: '165' };
  }
  return { min: 20, max: 500, placeholder: '75' };
}

export function heightRange(unit: UnitSystem): { min: number; max: number } {
  if (unit === 'imperial') {
    // ~20 in to ~118 in
    return { min: 20, max: 118 };
  }
  return { min: 50, max: 300 };
}
