/**
 * Layer B: LLM-only tests.
 * Feeds known transcript strings to GPT-4o-mini and validates nutrition parsing.
 * Isolates LLM behavior from Whisper transcription variance.
 */
import { parseNutrition } from './helpers';
import { AUDIO_FILES, KNOWN_TRANSCRIPTS, TRANSCRIPT_TO_AUDIO } from './expected-values';

const describeIf = process.env.OPENAI_API_KEY ? describe : describe.skip;

function expectInRange(actual: number, [min, max]: [number, number], label: string) {
  if (actual < min || actual > max) {
    throw new Error(`${label}: expected ${actual} to be in range [${min}, ${max}]`);
  }
}

describeIf('LLM-only (nutrition parsing from known transcripts)', () => {
  for (const [key, transcript] of Object.entries(KNOWN_TRANSCRIPTS)) {
    const audioFile = TRANSCRIPT_TO_AUDIO[key];
    const expected = AUDIO_FILES[audioFile];

    it(`parses nutrition for "${expected.label}"`, async () => {
      const result = await parseNutrition(transcript);
      console.log(`[LLM] ${key}:`, JSON.stringify(result, null, 2));

      // Item count
      expect(result.items.length).toBeGreaterThanOrEqual(expected.expectedItemCount[0]);
      expect(result.items.length).toBeLessThanOrEqual(expected.expectedItemCount[1]);

      // Meal type
      if (expected.mealType !== 'any') {
        expect(result.mealType).toBe(expected.mealType);
      }

      // Macro ranges
      expectInRange(result.totalCalories, expected.totalCalories, 'calories');
      expectInRange(result.totalProtein, expected.totalProtein, 'protein');
      expectInRange(result.totalCarbs, expected.totalCarbs, 'carbs');
      expectInRange(result.totalFat, expected.totalFat, 'fat');

      // Every item should have valid fields
      for (const item of result.items) {
        expect(item.calories).toBeGreaterThan(0);
        expect(item.confidence).toBeGreaterThanOrEqual(0);
        expect(item.confidence).toBeLessThanOrEqual(1);
        expect(item.quantity).toBeGreaterThan(0);
        expect(item.name.length).toBeGreaterThan(0);
      }
    });
  }
});
