import { computeItemSnapshot, aggregateNutritionTotals, FoodData, ItemSnapshot } from './nutrition';

const makeFoodData = (overrides?: Partial<FoodData['nutrients'][0]>): FoodData => ({
  id: 'food-1',
  normalizedName: 'Chicken Breast',
  servings: [
    { id: 'srv-1', label: '100g', gramsPerUnit: 100 },
    { id: 'srv-2', label: 'piece', gramsPerUnit: 200 },
  ],
  nutrients: [
    {
      caloriesPer100g: 165,
      proteinPer100g: 31,
      carbsPer100g: 0,
      fatPer100g: 3.6,
      fiberPer100g: 0,
      sugarPer100g: 0,
      sodiumPer100g: 74,
      saturatedFatPer100g: 1,
      ...overrides,
    },
  ],
});

describe('computeItemSnapshot', () => {
  it('computes correct nutrition for 1x 100g serving', () => {
    const result = computeItemSnapshot(makeFoodData(), 'srv-1', 1);
    expect(result).toEqual({
      foodId: 'food-1',
      quantity: 1,
      servingLabel: '100g',
      gramsPerUnit: 100,
      snapshotFoodName: 'Chicken Breast',
      snapshotCalories: 165,
      snapshotProtein: 31,
      snapshotCarbs: 0,
      snapshotFat: 3.6,
      snapshotFiber: 0,
      snapshotSugar: 0,
      snapshotSodium: 74,
      snapshotSaturatedFat: 1,
    });
  });

  it('scales correctly for 2x 200g serving (factor = 4)', () => {
    const result = computeItemSnapshot(makeFoodData(), 'srv-2', 2);
    expect(result.snapshotCalories).toBe(660);
    expect(result.snapshotProtein).toBe(124);
    expect(result.snapshotFat).toBe(14.4);
    expect(result.snapshotSodium).toBe(296);
  });

  it('returns null for nullable fields when nutrient value is null', () => {
    const food = makeFoodData({
      fiberPer100g: null,
      sugarPer100g: null,
      sodiumPer100g: null,
      saturatedFatPer100g: null,
    });
    const result = computeItemSnapshot(food, 'srv-1', 1);
    expect(result.snapshotFiber).toBeNull();
    expect(result.snapshotSugar).toBeNull();
    expect(result.snapshotSodium).toBeNull();
    expect(result.snapshotSaturatedFat).toBeNull();
  });

  it('handles string-typed numeric values (Prisma Decimal)', () => {
    const food = makeFoodData({
      caloriesPer100g: '165',
      proteinPer100g: '31',
      carbsPer100g: '0',
      fatPer100g: '3.6',
    });
    const result = computeItemSnapshot(food, 'srv-1', 1);
    expect(result.snapshotCalories).toBe(165);
    expect(result.snapshotProtein).toBe(31);
  });

  it('throws when serving not found', () => {
    expect(() => computeItemSnapshot(makeFoodData(), 'bad-srv', 1)).toThrow(
      'Serving bad-srv not found for food food-1',
    );
  });

  it('throws when no nutrient data', () => {
    const food: FoodData = { ...makeFoodData(), nutrients: [] };
    expect(() => computeItemSnapshot(food, 'srv-1', 1)).toThrow('Food food-1 has no nutrient data');
  });
});

describe('aggregateNutritionTotals', () => {
  const baseSnapshot: ItemSnapshot = {
    foodId: 'f1',
    quantity: 1,
    servingLabel: '100g',
    gramsPerUnit: 100,
    snapshotFoodName: 'Food A',
    snapshotCalories: 100,
    snapshotProtein: 10,
    snapshotCarbs: 20,
    snapshotFat: 5,
    snapshotFiber: 3,
    snapshotSugar: 2,
    snapshotSodium: 50,
    snapshotSaturatedFat: 1,
  };

  it('sums totals across multiple snapshots', () => {
    const snapshots = [baseSnapshot, { ...baseSnapshot, foodId: 'f2' }];
    const result = aggregateNutritionTotals(snapshots);
    expect(result.totalCalories).toBe(200);
    expect(result.totalProtein).toBe(20);
    expect(result.totalCarbs).toBe(40);
    expect(result.totalFat).toBe(10);
    expect(result.totalFiber).toBe(6);
    expect(result.totalSugar).toBe(4);
    expect(result.totalSodium).toBe(100);
    expect(result.totalSaturatedFat).toBe(2);
  });

  it('returns null for nullable fields when all items have null', () => {
    const snapshots = [
      {
        ...baseSnapshot,
        snapshotFiber: null,
        snapshotSugar: null,
        snapshotSodium: null,
        snapshotSaturatedFat: null,
      },
    ];
    const result = aggregateNutritionTotals(snapshots);
    expect(result.totalFiber).toBeNull();
    expect(result.totalSugar).toBeNull();
    expect(result.totalSodium).toBeNull();
    expect(result.totalSaturatedFat).toBeNull();
  });

  it('sums nullable fields when at least one item has a value', () => {
    const snapshots = [
      { ...baseSnapshot, snapshotFiber: null },
      { ...baseSnapshot, snapshotFiber: 3 },
    ];
    const result = aggregateNutritionTotals(snapshots);
    expect(result.totalFiber).toBe(3);
  });

  it('handles empty array', () => {
    const result = aggregateNutritionTotals([]);
    expect(result.totalCalories).toBe(0);
    expect(result.totalProtein).toBe(0);
    expect(result.totalFiber).toBeNull();
  });
});
