/**
 * Body Mass Index (BMI) = weightKg / (heightMeters^2)
 * Returns one decimal place, or null when inputs are missing/invalid.
 */
export function calculateBmi(
  heightCm: number | null,
  weightKg: number | null,
): number | null {
  if (heightCm == null || weightKg == null || heightCm <= 0 || weightKg <= 0) {
    return null;
  }

  const heightM = heightCm / 100;
  return Number((weightKg / (heightM * heightM)).toFixed(1));
}
