/**
 * Test cases for Telegram food parsing integration tests.
 *
 * Each case has a text message and expected parsing result.
 * Covers: food logs (Mongolian, English, mixed), non-food messages,
 * edge cases (greetings, questions, ambiguous).
 */

export interface TelegramTestCase {
  label: string;
  text: string;
  expectedIsFoodLog: boolean;
  /** Only checked when isFoodLog is true */
  mealType?: string | null | 'any';
  expectedItemCount?: [number, number];
  totalCalories?: [number, number];
  totalProtein?: [number, number];
  totalCarbs?: [number, number];
  totalFat?: [number, number];
}

export const TELEGRAM_FOOD_LOGS: TelegramTestCase[] = [
  // --- Food logs (should be classified as isFoodLog: true) ---
  {
    label: 'Mongolian buuz with quantity',
    text: '5 бууз идлээ',
    expectedIsFoodLog: true,
    mealType: 'any',
    expectedItemCount: [1, 2],
    // 5 buuz × 90 cal = 450
    totalCalories: [300, 600],
    totalProtein: [20, 50],
    totalCarbs: [15, 45],
    totalFat: [10, 35],
  },
  {
    label: 'Mongolian breakfast with tea',
    text: 'Өглөөний цайндаа 3 хуушуур, суутэй цай уулаа',
    expectedIsFoodLog: true,
    mealType: 'breakfast',
    expectedItemCount: [2, 3],
    // 3 khuushuur (360) + suutei tsai (35) ≈ 395
    totalCalories: [250, 550],
    totalProtein: [10, 35],
    totalCarbs: [15, 50],
    totalFat: [10, 30],
  },
  {
    label: 'English meal description',
    text: 'I had 2 eggs, toast, and coffee for breakfast',
    expectedIsFoodLog: true,
    mealType: 'breakfast',
    expectedItemCount: [2, 4],
    totalCalories: [200, 500],
    totalProtein: [10, 30],
    totalCarbs: [10, 50],
    totalFat: [5, 25],
  },
  {
    label: 'Mixed Mongolian/English casual',
    text: 'KFC-ээс 2 piece chicken, french fries авлаа',
    expectedIsFoodLog: true,
    mealType: 'any',
    expectedItemCount: [2, 3],
    // 2 KFC pieces (640) + fries (380) ≈ 1020
    totalCalories: [500, 1400],
    totalProtein: [20, 70],
    totalCarbs: [30, 120],
    totalFat: [20, 70],
  },
  {
    label: 'Simple single item with context',
    text: 'Өнөөдөр суутэй цай уулаа',
    expectedIsFoodLog: true,
    mealType: 'any',
    expectedItemCount: [1, 1],
    // suutei tsai: ~35 cal
    totalCalories: [2, 80],
    totalProtein: [0, 5],
    totalCarbs: [0, 10],
    totalFat: [0, 5],
  },
  {
    label: 'Dinner with tsuivan',
    text: 'Оройн хоолондоо нэг таваг цуйван идлээ',
    expectedIsFoodLog: true,
    mealType: 'dinner',
    expectedItemCount: [1, 2],
    // tsuivan: 550 cal/bowl
    totalCalories: [350, 700],
    totalProtein: [15, 40],
    totalCarbs: [30, 80],
    totalFat: [10, 30],
  },
  {
    label: 'Korean food popular in UB',
    text: '점심에 비빔밥 먹었어 bibimbap idlee',
    expectedIsFoodLog: true,
    mealType: 'any',
    expectedItemCount: [1, 2],
    // bibimbap: 550 cal
    totalCalories: [350, 750],
    totalProtein: [12, 35],
    totalCarbs: [50, 110],
    totalFat: [5, 25],
  },

  // --- Non-food messages (should be classified as isFoodLog: false) ---
  {
    label: 'Greeting in Mongolian',
    text: 'Сайн уу',
    expectedIsFoodLog: false,
  },
  {
    label: 'Question about food',
    text: 'Маргааш юу идэх вэ?',
    expectedIsFoodLog: false,
  },
  {
    label: 'Asking for calorie info',
    text: 'Нэг бууз хэдэн калори вэ?',
    expectedIsFoodLog: false,
  },
  {
    label: 'General chat in English',
    text: 'How are you doing today?',
    expectedIsFoodLog: false,
  },
  {
    label: 'Asking for advice',
    text: 'Жин хасахын тулд юу идэх хэрэгтэй вэ?',
    expectedIsFoodLog: false,
  },
  {
    label: 'Random non-food text',
    text: 'Өнөөдөр цаг агаар сайхан байна',
    expectedIsFoodLog: false,
  },
];
