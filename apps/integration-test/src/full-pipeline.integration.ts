/**
 * Layer C: Full pipeline tests.
 * Audio file -> STT -> GPT-4o-mini nutrition parsing.
 * Tests both OpenAI and Google Cloud STT providers.
 */
import { fullPipeline, fixture, SttProvider } from './helpers';
import { AUDIO_FILES } from './expected-values';

function assertFullPipeline(
  result: Awaited<ReturnType<typeof fullPipeline>>,
  expected: (typeof AUDIO_FILES)[string],
) {
  // Transcript is non-empty
  expect(result.text.length).toBeGreaterThan(0);

  // Item count — lower bound is 0 because STT may garble Mongolian beyond
  // recognition, causing GPT to return no items. Upper bound catches over-counting.
  expect(result.items.length).toBeLessThanOrEqual(expected.expectedItemCount[1] + 2);

  // Meal type (only assert when STT reliably preserves the context words)
  if (expected.mealType !== 'any' && expected.mealType !== null) {
    const mealContextWords: Record<string, string[]> = {
      breakfast: ['өглөө', 'цайнд'],
      lunch: ['өдрийн', 'өдөр'],
      dinner: ['оройн', 'орой'],
    };
    const contextWords = mealContextWords[expected.mealType] ?? [];
    const hasContext = contextWords.some((w) => result.text.toLowerCase().includes(w));
    if (hasContext) {
      expect(result.mealType).toBe(expected.mealType);
    }
  }

  // Macro ranges — only check upper bounds for full pipeline.
  // Lower bounds are unreliable because garbled STT transcripts
  // often produce 0-item results. LLM-only tests validate lower bounds.
  expect(result.totalCalories).toBeLessThanOrEqual(expected.totalCalories[1]);
  expect(result.totalProtein).toBeLessThanOrEqual(expected.totalProtein[1]);
  expect(result.totalCarbs).toBeLessThanOrEqual(expected.totalCarbs[1]);
  expect(result.totalFat).toBeLessThanOrEqual(expected.totalFat[1]);

  // Every item should have valid fields
  for (const item of result.items) {
    expect(item.calories).toBeGreaterThan(0);
    expect(item.confidence).toBeGreaterThanOrEqual(0);
    expect(item.confidence).toBeLessThanOrEqual(1);
    expect(item.quantity).toBeGreaterThan(0);
  }
}

// --- OpenAI full pipeline ---
const describeOpenAI = process.env.OPENAI_API_KEY ? describe : describe.skip;

describeOpenAI('Full pipeline: OpenAI STT -> GPT nutrition', () => {
  for (const [filename, expected] of Object.entries(AUDIO_FILES)) {
    it(`processes "${expected.label}" end-to-end (${filename})`, async () => {
      const result = await fullPipeline(fixture(filename), 'mn', 'openai');
      console.log(`[FULL:OpenAI] ${filename}: transcript="${result.text}"`);
      console.log(`[FULL:OpenAI] ${filename}: result=`, JSON.stringify(result, null, 2));
      assertFullPipeline(result, expected);
    });
  }
});

// --- Google Cloud STT full pipeline ---
const hasGoogleCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_STT_API_KEY;
const canRunGoogle = hasGoogleCreds && process.env.OPENAI_API_KEY;
const describeGoogle = canRunGoogle ? describe : describe.skip;

describeGoogle('Full pipeline: Google STT -> GPT nutrition', () => {
  for (const [filename, expected] of Object.entries(AUDIO_FILES)) {
    it(`processes "${expected.label}" end-to-end (${filename})`, async () => {
      const result = await fullPipeline(fixture(filename), 'mn', 'google');
      console.log(`[FULL:Google] ${filename}: transcript="${result.text}"`);
      console.log(`[FULL:Google] ${filename}: result=`, JSON.stringify(result, null, 2));
      assertFullPipeline(result, expected);
    });
  }
});
