/**
 * Telegram food parsing integration tests.
 *
 * Tests the GPT-4o-mini food parsing pipeline used by the Telegram bot.
 * Validates:
 *   - isFoodLog classification (food vs non-food messages)
 *   - Meal type detection
 *   - Nutrition extraction accuracy (calorie/macro ranges)
 *   - Mongolian, English, and mixed-language messages
 */
import { parseTelegramMessage } from './telegram-helpers';
import { TELEGRAM_FOOD_LOGS, TelegramTestCase } from './telegram-expected';

const describeIf = process.env.OPENAI_API_KEY ? describe : describe.skip;

const foodLogs = TELEGRAM_FOOD_LOGS.filter((t) => t.expectedIsFoodLog);
const nonFoodMessages = TELEGRAM_FOOD_LOGS.filter((t) => !t.expectedIsFoodLog);

function expectInRange(actual: number, [min, max]: [number, number], label: string) {
  if (actual < min || actual > max) {
    throw new Error(`${label}: expected ${actual} to be in range [${min}, ${max}]`);
  }
}

describeIf('Telegram food parsing: food log messages', () => {
  for (const tc of foodLogs) {
    it(`parses "${tc.label}": "${tc.text}"`, async () => {
      const result = await parseTelegramMessage(tc.text);
      console.log(`[TG] ${tc.label}:`, JSON.stringify(result, null, 2));

      expect(result.isFoodLog).toBe(true);

      // Item count
      if (tc.expectedItemCount) {
        expect(result.items.length).toBeGreaterThanOrEqual(tc.expectedItemCount[0]);
        expect(result.items.length).toBeLessThanOrEqual(tc.expectedItemCount[1]);
      }

      // Meal type
      if (tc.mealType && tc.mealType !== 'any') {
        expect(result.mealType).toBe(tc.mealType);
      }

      // Macro ranges
      if (tc.totalCalories) expectInRange(result.totalCalories, tc.totalCalories, 'calories');
      if (tc.totalProtein) expectInRange(result.totalProtein, tc.totalProtein, 'protein');
      if (tc.totalCarbs) expectInRange(result.totalCarbs, tc.totalCarbs, 'carbs');
      if (tc.totalFat) expectInRange(result.totalFat, tc.totalFat, 'fat');

      // Every item should have valid fields
      for (const item of result.items) {
        expect(item.calories).toBeGreaterThanOrEqual(0);
        expect(item.confidence).toBeGreaterThanOrEqual(0);
        expect(item.confidence).toBeLessThanOrEqual(1);
        expect(item.quantity).toBeGreaterThan(0);
        expect(item.name.length).toBeGreaterThan(0);
      }
    });
  }
});

describeIf('Telegram food parsing: non-food messages', () => {
  for (const tc of nonFoodMessages) {
    it(`rejects "${tc.label}": "${tc.text}"`, async () => {
      const result = await parseTelegramMessage(tc.text);
      console.log(`[TG:non-food] ${tc.label}:`, JSON.stringify(result));

      expect(result.isFoodLog).toBe(false);
      expect(result.items).toHaveLength(0);
      expect(result.totalCalories).toBe(0);
    });
  }
});
