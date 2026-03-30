/**
 * Expected value ranges for photo parsing integration tests.
 *
 * Each photo fixture needs a .jpg file in fixtures/photos/.
 * Add your food photos and update this file with expected ranges.
 *
 * To add a new test photo:
 * 1. Place the .jpg in apps/integration-test/fixtures/photos/
 * 2. Add an entry below with label and expected nutrition ranges
 * 3. Run: npm run test:integration
 */

export interface PhotoExpectedRange {
  label: string;
  /** Substrings that should appear in the mealName (case-insensitive) */
  mealNameMayInclude?: string[];
  expectedItemCount: [number, number];
  totalCalories: [number, number];
  totalProtein: [number, number];
  totalCarbs: [number, number];
  totalFat: [number, number];
}

/**
 * Map of photo fixture filenames to expected nutrition ranges.
 * Ranges are generous because vision models estimate portion sizes differently.
 *
 * IMPORTANT: You must place actual food photos at the paths below.
 * Without real photos, photo tests will be skipped.
 */
export const PHOTO_FILES: Record<string, PhotoExpectedRange> = {
  // Example entries — uncomment and add photos to enable:
  // 'buuz-plate.jpg': {
  //   label: 'Plate of buuz (steamed dumplings)',
  //   mealNameMayInclude: ['бууз', 'buuz', 'dumpling'],
  //   expectedItemCount: [1, 5],
  //   totalCalories: [300, 1200],
  //   totalProtein: [15, 70],
  //   totalCarbs: [15, 80],
  //   totalFat: [10, 60],
  // },
  // 'tsuivan-bowl.jpg': {
  //   label: 'Bowl of tsuivan (stir-fried noodles)',
  //   mealNameMayInclude: ['цуйван', 'tsuivan', 'noodle'],
  //   expectedItemCount: [1, 4],
  //   totalCalories: [300, 800],
  //   totalProtein: [15, 40],
  //   totalCarbs: [30, 80],
  //   totalFat: [8, 30],
  // },
  // 'chicken-rice.jpg': {
  //   label: 'Chicken and rice plate',
  //   mealNameMayInclude: ['chicken', 'rice', 'тахиа', 'будаа'],
  //   expectedItemCount: [1, 5],
  //   totalCalories: [300, 800],
  //   totalProtein: [20, 50],
  //   totalCarbs: [30, 70],
  //   totalFat: [5, 30],
  // },
  // 'kfc-meal.jpg': {
  //   label: 'KFC meal with fries',
  //   mealNameMayInclude: ['KFC', 'chicken', 'fried'],
  //   expectedItemCount: [1, 5],
  //   totalCalories: [500, 1500],
  //   totalProtein: [20, 70],
  //   totalCarbs: [30, 100],
  //   totalFat: [20, 70],
  // },
  // 'salad.jpg': {
  //   label: 'Mixed salad',
  //   mealNameMayInclude: ['salad', 'салат'],
  //   expectedItemCount: [1, 8],
  //   totalCalories: [50, 500],
  //   totalProtein: [2, 30],
  //   totalCarbs: [5, 40],
  //   totalFat: [2, 30],
  // },
};
