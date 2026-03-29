// ─── Weight ──────────────────────────────────────────────────────────────────

/** Round kg to display precision. */
export function displayWeight(kg: number, decimals = 1): number {
  return Number(kg.toFixed(decimals));
}

/** Identity — input is always in kg. */
export function inputToKg(value: number): number {
  return value;
}

/** Display a weekly rate value. */
export function displayWeeklyRate(kgPerWeek: number): string {
  return kgPerWeek.toFixed(2);
}

// ─── Height ──────────────────────────────────────────────────────────────────

/** Display height in cm. */
export function displayHeight(cm: number): string {
  return `${cm} cm`;
}

// ─── Body measurements ───────────────────────────────────────────────────────

/** Round cm to display precision. */
export function displayMeasurement(cm: number, decimals = 1): number {
  return Number(cm.toFixed(decimals));
}

/** Identity — input is always in cm. */
export function inputToCm(value: number): number {
  return value;
}

// ─── Validation ranges ───────────────────────────────────────────────────────

export function weightRange(): { min: number; max: number; placeholder: string } {
  return { min: 20, max: 500, placeholder: '75' };
}

export function heightRange(): { min: number; max: number } {
  return { min: 50, max: 300 };
}
