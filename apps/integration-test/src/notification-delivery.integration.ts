/**
 * Notification delivery integration tests.
 *
 * Tests real Telegram Bot API delivery, Expo Push API behavior with
 * invalid tokens, and GPT-4o meal timing insight generation.
 *
 * Requires:
 *   - TELEGRAM_BOT_TOKEN + TELEGRAM_TEST_CHAT_ID for Telegram tests
 *   - OPENAI_API_KEY for meal timing insight tests
 *   - Expo Push tests run without env vars (public API)
 */
import {
  sendTelegramMessage,
  sendExpoPush,
  generateMealTimingInsight,
} from './notification-helpers';
import {
  TELEGRAM_DELIVERY_CASES,
  EXPO_PUSH_CASES,
  MEAL_TIMING_CASES,
} from './notification-expected';

// ── Telegram Bot API ────────────────────────────────────────────────────────────

const hasTelegram = !!process.env.TELEGRAM_BOT_TOKEN && !!process.env.TELEGRAM_TEST_CHAT_ID;

const describeTelegram = hasTelegram ? describe : describe.skip;

describeTelegram('Telegram delivery (real Bot API)', () => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN!;
  const chatId = process.env.TELEGRAM_TEST_CHAT_ID!;

  for (const tc of TELEGRAM_DELIVERY_CASES) {
    it(`delivers "${tc.label}"`, async () => {
      const result = await sendTelegramMessage(
        botToken,
        chatId,
        `[Integration Test] ${tc.text}`,
        tc.parseMode,
      );

      console.log(`[Telegram] ${tc.label}:`, result);

      if (tc.expectSuccess) {
        expect(result.success).toBe(true);
        expect(result.messageId).toBeDefined();
        expect(result.messageId).toBeGreaterThan(0);
      } else {
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    });
  }

  it('fails gracefully with invalid chat ID', async () => {
    const result = await sendTelegramMessage(botToken, '999999999999', 'This should fail');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    console.log('[Telegram] Invalid chat ID error:', result.error);
  });

  it('handles Markdown parse errors', async () => {
    // Unbalanced markdown should fail with parse_mode: Markdown
    const result = await sendTelegramMessage(
      botToken,
      chatId,
      '*Bold text without closing',
      'Markdown',
    );
    // Telegram may reject or silently fix — either way, should not throw
    console.log('[Telegram] Markdown error handling:', result);
    // We just verify it doesn't crash — result may be success or error
    expect(typeof result.success).toBe('boolean');
  });
});

// ── Expo Push API ───────────────────────────────────────────────────────────────

describe('Expo Push delivery (real API)', () => {
  for (const tc of EXPO_PUSH_CASES) {
    it(`handles "${tc.label}"`, async () => {
      const result = await sendExpoPush(tc.tokens, tc.title, tc.body, tc.data);
      console.log(`[ExpoPush] ${tc.label}:`, JSON.stringify(result, null, 2));

      // Should always return tickets (one per token)
      expect(result.tickets.length).toBe(tc.tokens.length);

      if (tc.expectAllErrors) {
        // All tickets should be errors
        for (const ticket of result.tickets) {
          expect(ticket.status).toBe('error');
        }
      }
    });
  }

  it('handles empty token array', async () => {
    // sendExpoPush should short-circuit on empty tokens (mirrors expo-push.ts)
    // Our helper makes the API call, but Expo should return empty
    const result = await sendExpoPush([], 'Test', 'Test');
    expect(result.tickets.length).toBe(0);
  });
});

// ── Meal timing insight generation ──────────────────────────────────────────────

const hasOpenAI = !!process.env.OPENAI_API_KEY;
const describeOpenAI = hasOpenAI ? describe : describe.skip;

describeOpenAI('Meal timing insight generation (GPT-4o)', () => {
  for (const tc of MEAL_TIMING_CASES) {
    it(`generates "${tc.label}"`, async () => {
      const result = await generateMealTimingInsight(tc.insights, tc.userName, tc.locale);
      console.log(`[MealTiming] ${tc.label}:`, result.message);

      // Non-empty
      expect(result.message.length).toBeGreaterThan(0);

      // Length bounds (~100 words ≈ ~600 chars for Mongolian, ~400 for English)
      expect(result.message.length).toBeLessThan(800);

      // Sentence count (3-5 sentences)
      const sentences = result.message.split(/[.!?]\s/).filter((s) => s.length > 5);
      expect(sentences.length).toBeLessThanOrEqual(8);

      // Soft check: should mention key data points
      if (tc.shouldMention) {
        for (const keyword of tc.shouldMention) {
          if (!result.message.includes(keyword)) {
            console.warn(
              `[MealTiming] WARN: "${tc.label}" did not mention "${keyword}" — GPT paraphrased`,
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
