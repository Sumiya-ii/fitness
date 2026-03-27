/**
 * Shared nutrition snapshot calculation logic.
 *
 * Used by meal-logs and meal-templates services to compute per-item
 * nutrition snapshots and aggregate totals from food/serving/nutrient data.
 */

/** A numeric value that can be coerced via Number() — covers number, string, and Prisma Decimal. */
type Numeric = number | string | { toNumber(): number } | { toString(): string };

/** Minimal nutrient shape expected by the calculator. */
export interface NutrientData {
  caloriesPer100g: Numeric | null;
  proteinPer100g: Numeric | null;
  carbsPer100g: Numeric | null;
  fatPer100g: Numeric | null;
  fiberPer100g?: Numeric | null;
  sugarPer100g?: Numeric | null;
  sodiumPer100g?: Numeric | null;
  saturatedFatPer100g?: Numeric | null;
}

/** Minimal serving shape expected by the calculator. */
export interface ServingData {
  id: string;
  label: string;
  gramsPerUnit: Numeric;
}

/** Minimal food shape expected by the calculator. */
export interface FoodData {
  id: string;
  normalizedName: string;
  servings: ServingData[];
  nutrients: NutrientData[];
}

/** Input item requesting a nutrition snapshot. */
export interface SnapshotInput {
  foodId: string;
  servingId: string;
  quantity: number;
}

/** Computed per-item nutrition snapshot. */
export interface ItemSnapshot {
  foodId: string;
  quantity: number;
  servingLabel: string;
  gramsPerUnit: number;
  snapshotFoodName: string;
  snapshotCalories: number;
  snapshotProtein: number;
  snapshotCarbs: number;
  snapshotFat: number;
  snapshotFiber: number | null;
  snapshotSugar: number | null;
  snapshotSodium: number | null;
  snapshotSaturatedFat: number | null;
}

/** Aggregated totals across all item snapshots. */
export interface NutritionTotals {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalFiber: number | null;
  totalSugar: number | null;
  totalSodium: number | null;
  totalSaturatedFat: number | null;
}

/**
 * Scale a nullable per-100g value by the given factor, rounding to 2 decimal places.
 * Returns null if the value is null or undefined.
 */
function scaleNullable(value: Numeric | null | undefined, factor: number): number | null {
  if (value === null || value === undefined) return null;
  return Number((Number(value) * factor).toFixed(2));
}

/**
 * Compute a nutrition snapshot for a single food item given its food data,
 * serving selection, and quantity.
 *
 * Throws descriptive error messages (as strings) when food, serving, or
 * nutrient data is missing. The caller should catch and wrap in the
 * appropriate HTTP exception.
 */
export function computeItemSnapshot(
  food: FoodData,
  servingId: string,
  quantity: number,
): ItemSnapshot {
  const serving = food.servings.find((s) => s.id === servingId);
  if (!serving) {
    throw new Error(`Serving ${servingId} not found for food ${food.id}`);
  }

  const nutrient = food.nutrients[0];
  if (!nutrient) {
    throw new Error(`Food ${food.id} has no nutrient data`);
  }

  const totalGrams = Number(serving.gramsPerUnit) * quantity;
  const factor = totalGrams / 100;

  return {
    foodId: food.id,
    quantity,
    servingLabel: serving.label,
    gramsPerUnit: Number(serving.gramsPerUnit),
    snapshotFoodName: food.normalizedName,
    snapshotCalories: Math.round(Number(nutrient.caloriesPer100g) * factor),
    snapshotProtein: Number((Number(nutrient.proteinPer100g) * factor).toFixed(2)),
    snapshotCarbs: Number((Number(nutrient.carbsPer100g) * factor).toFixed(2)),
    snapshotFat: Number((Number(nutrient.fatPer100g) * factor).toFixed(2)),
    snapshotFiber: scaleNullable(nutrient.fiberPer100g, factor),
    snapshotSugar: scaleNullable(nutrient.sugarPer100g, factor),
    snapshotSodium: scaleNullable(nutrient.sodiumPer100g, factor),
    snapshotSaturatedFat: scaleNullable(nutrient.saturatedFatPer100g, factor),
  };
}

/**
 * Sum a nullable field across snapshots.
 * Returns null if no snapshot has a non-null value for the field.
 */
function sumNullableField(
  snapshots: ItemSnapshot[],
  field: 'snapshotFiber' | 'snapshotSugar' | 'snapshotSodium' | 'snapshotSaturatedFat',
): number | null {
  return snapshots.some((i) => i[field] !== null)
    ? Number(snapshots.reduce((sum, i) => sum + (i[field] ?? 0), 0).toFixed(2))
    : null;
}

/**
 * Aggregate nutrition totals from an array of item snapshots.
 */
export function aggregateNutritionTotals(snapshots: ItemSnapshot[]): NutritionTotals {
  return {
    totalCalories: snapshots.reduce((sum, i) => sum + i.snapshotCalories, 0),
    totalProtein: Number(snapshots.reduce((sum, i) => sum + i.snapshotProtein, 0).toFixed(2)),
    totalCarbs: Number(snapshots.reduce((sum, i) => sum + i.snapshotCarbs, 0).toFixed(2)),
    totalFat: Number(snapshots.reduce((sum, i) => sum + i.snapshotFat, 0).toFixed(2)),
    totalFiber: sumNullableField(snapshots, 'snapshotFiber'),
    totalSugar: sumNullableField(snapshots, 'snapshotSugar'),
    totalSodium: sumNullableField(snapshots, 'snapshotSodium'),
    totalSaturatedFat: sumNullableField(snapshots, 'snapshotSaturatedFat'),
  };
}
