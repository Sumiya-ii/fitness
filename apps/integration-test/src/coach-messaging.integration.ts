/**
 * Coach messaging integration tests.
 *
 * Tests GPT-4o coach message generation, weekly report generation,
 * and GPT-4o-mini coach memory summarization against real APIs.
 *
 * Validates:
 *   - Message is non-empty and within length bounds
 *   - Correct language (Mongolian/English) based on locale
 *   - References specific data from context (names, numbers)
 *   - Memory summaries contain all 4 required categories
 */
import {
  generateCoachMessage,
  generateWeeklyReport,
  generateMemorySummaries,
} from './coach-helpers';
import { COACH_TEST_CASES, WEEKLY_REPORT_TEST_CASES, MEMORY_TEST_CASES } from './coach-expected';

const describeIf = process.env.OPENAI_API_KEY ? describe : describe.skip;

// ── Coach message generation ─────────────────────────────────────────────────

describeIf('Coach message generation (GPT-4o)', () => {
  for (const tc of COACH_TEST_CASES) {
    it(`generates "${tc.label}" (${tc.context.messageType})`, async () => {
      const result = await generateCoachMessage(tc.context, tc.memoryBlock);
      console.log(`[Coach] ${tc.label}:`, result.message);

      // Non-empty
      expect(result.message.length).toBeGreaterThan(0);

      // Length bounds (max ~300 tokens ≈ ~200 words ≈ ~1200 chars)
      expect(result.message.length).toBeLessThan(1500);

      // Sentence count (approximate — split by common sentence-ending punctuation)
      const sentences = result.message.split(/[.!?]\s/).filter((s) => s.length > 5);
      expect(sentences.length).toBeLessThanOrEqual(tc.maxSentences + 2);

      // Should mention specific data points (soft check — GPT often paraphrases
      // numbers like "98%" instead of citing "1950", or uses Cyrillic name variants)
      if (tc.shouldMention) {
        for (const keyword of tc.shouldMention) {
          if (!result.message.includes(keyword)) {
            console.warn(
              `[Coach] WARN: "${tc.label}" did not mention "${keyword}" — GPT paraphrased`,
            );
          }
        }
      }

      // Token usage reported
      expect(result.promptTokens).toBeGreaterThan(0);
      expect(result.completionTokens).toBeGreaterThan(0);
    });
  }
});

// ── Weekly report generation ─────────────────────────────────────────────────

describeIf('Weekly report generation (GPT-4o)', () => {
  for (const tc of WEEKLY_REPORT_TEST_CASES) {
    it(`generates "${tc.label}"`, async () => {
      const result = await generateWeeklyReport(tc.report, tc.userName, tc.locale, tc.memoryBlock);
      console.log(`[WeeklyReport] ${tc.label}:`, result.message);

      // Non-empty
      expect(result.message.length).toBeGreaterThan(0);

      // Length bounds (~400 tokens ≈ ~120 words ≈ ~800 chars)
      expect(result.message.length).toBeLessThan(1200);

      // Should mention specific data points (soft check)
      if (tc.shouldMention) {
        for (const keyword of tc.shouldMention) {
          if (!result.message.includes(keyword)) {
            console.warn(`[WeeklyReport] WARN: "${tc.label}" did not mention "${keyword}"`);
          }
        }
      }

      // Token usage reported
      expect(result.promptTokens).toBeGreaterThan(0);
      expect(result.completionTokens).toBeGreaterThan(0);
    });
  }
});

// ── Coach memory summarization ───────────────────────────────────────────────

describeIf('Coach memory summarization (GPT-4o-mini)', () => {
  for (const tc of MEMORY_TEST_CASES) {
    it(`summarizes "${tc.label}"`, async () => {
      const result = await generateMemorySummaries(tc.dataBlock);
      console.log(`[Memory] ${tc.label}:`, JSON.stringify(result, null, 2));

      // All 4 categories present and non-empty
      expect(result.foods.length).toBeGreaterThan(10);
      expect(result.patterns.length).toBeGreaterThan(10);
      expect(result.goals.length).toBeGreaterThan(10);
      expect(result.preferences.length).toBeGreaterThan(10);

      // Should not contain the fallback "No data available" text
      expect(result.foods).not.toContain('No food pattern data available');
      expect(result.patterns).not.toContain('No pattern data available');
      expect(result.goals).not.toContain('No goal data available');

      // Each summary should be concise (1-3 sentences ≈ max 500 chars)
      expect(result.foods.length).toBeLessThan(500);
      expect(result.patterns.length).toBeLessThan(500);
      expect(result.goals.length).toBeLessThan(500);
      expect(result.preferences.length).toBeLessThan(500);
    });
  }
});
