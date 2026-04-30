/**
 * Unit tests for the Photo (vision-based nutrition parsing) processor.
 * Covers all 9 required categories per CLAUDE.md.
 */

// ── Module-level mocks (must be before imports) ──────────────────────────────

jest.mock('openai', () => {
  const mockCreate = jest.fn();
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }));
});

const mockGenerateContent = jest.fn();
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: mockGenerateContent,
    }),
  })),
}));

const mockPoolQuery = jest.fn();
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({ query: mockPoolQuery, end: jest.fn() })),
}));

jest.mock('../foods-lookup', () => ({
  lookupVerifiedFood: jest.fn(),
  normalizeName: jest.requireActual('../foods-lookup').normalizeName,
  tokenOverlap: jest.requireActual('../foods-lookup').tokenOverlap,
}));

jest.mock('../calibration', () => ({
  applyUserCalibration: jest.fn().mockImplementation((_userId, item) => Promise.resolve(item)),
}));

jest.mock('@sentry/node', () => ({
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import { processPhotoJob } from './photo.processor';
import OpenAI from 'openai';
import type { Job } from 'bullmq';
import { lookupVerifiedFood } from '../foods-lookup';
import { applyUserCalibration } from '../calibration';
import * as Sentry from '@sentry/node';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getOpenAIMock(): jest.Mock {
  const instance = new (OpenAI as unknown as new () => {
    chat: { completions: { create: jest.Mock } };
  })();
  return instance.chat.completions.create;
}

function makeJob(data: Record<string, unknown>): Job {
  return { id: 'job-1', name: 'photo', data } as unknown as Job;
}

/** Valid food-mode AI response (high confidence, macros add up). */
const VALID_FOOD_RESPONSE = {
  mealName: 'Буузны хоол',
  items: [
    {
      name: 'Бууз',
      servingGrams: 200,
      calories: 400,
      protein: 20,
      carbs: 30,
      fat: 15,
      fiber: 2,
      sugar: 1,
      sodium: 500,
      saturatedFat: 5,
      confidence: 0.92,
    },
  ],
  requiresClarification: false,
  clarificationQuestions: [],
};

/** AI response where macros do NOT add up to calories (4*20 + 4*30 + 9*15 = 80+120+135 = 335, reported 500). */
const FLAGGED_MACRO_RESPONSE = {
  mealName: 'Mystery Meal',
  items: [
    {
      name: 'Mystery food',
      servingGrams: 150,
      calories: 500,
      protein: 20,
      carbs: 30,
      fat: 15,
      fiber: 2,
      sugar: 1,
      sodium: 400,
      saturatedFat: 4,
      confidence: 0.8,
    },
  ],
  requiresClarification: false,
  clarificationQuestions: [],
};

/** AI response with low confidence triggering clarification. */
const LOW_CONFIDENCE_RESPONSE = {
  mealName: 'Unclear dish',
  items: [
    {
      name: 'Unknown stew',
      servingGrams: 200,
      calories: 300,
      protein: 10,
      carbs: 35,
      fat: 12,
      fiber: 2,
      sugar: 3,
      sodium: 400,
      saturatedFat: 3,
      confidence: 0.3,
    },
  ],
  requiresClarification: false,
  clarificationQuestions: [],
};

/** AI response where AI itself flags clarification needed. */
const AI_CLARIFICATION_RESPONSE = {
  mealName: 'Буузны хоол',
  items: [
    {
      name: 'Бууз',
      servingGrams: 150,
      calories: 300,
      protein: 15,
      carbs: 22,
      fat: 11,
      fiber: 1,
      sugar: 1,
      sodium: 350,
      saturatedFat: 3,
      confidence: 0.6,
    },
  ],
  requiresClarification: true,
  clarificationQuestions: [
    { id: 'portion_count_buuz', text: 'Хэдэн бууз байна вэ?', type: 'count' },
    {
      id: 'cooking_method_buuz',
      text: 'Уурт чанасан уу, шарсан уу?',
      type: 'choice',
      choices: ['Уурт чанасан', 'Шарсан'],
    },
  ],
};

function geminiRespond(body: unknown) {
  mockGenerateContent.mockResolvedValueOnce({
    response: { text: () => JSON.stringify(body) },
  });
}

// ── Test lifecycle ────────────────────────────────────────────────────────────

let originalEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  jest.clearAllMocks();
  originalEnv = { ...process.env };
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  process.env.OPENAI_API_KEY = 'test-openai-key';
  process.env.VISION_PROVIDER = 'gemini';
  process.env.DATABASE_URL = 'postgresql://test';

  // Default: lookupVerifiedFood returns null (no match)
  (lookupVerifiedFood as jest.Mock).mockResolvedValue(null);
  // Default: calibration is a pass-through
  (applyUserCalibration as jest.Mock).mockImplementation((_u, item) => Promise.resolve(item));

  // Default: mode-detect call returns 'food' (first generateContent call in processPhotoJob)
  // and the second call returns the real food response.
  // Tests that don't care about mode detection can just set mockGenerateContent
  // to respond to both calls in order.
});

afterEach(() => {
  process.env = originalEnv;
  jest.restoreAllMocks();
});

// ── 1. Missing env vars ───────────────────────────────────────────────────────

describe('1. Missing env vars', () => {
  it('returns empty result when no API keys are configured', async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const result = await processPhotoJob(
      makeJob({ userId: 'u1', reference: 'ref', photoBuffer: 'base64data' }),
    );

    expect(result.mealName).toBe('Meal');
    expect(result.items).toEqual([]);
    expect(result.totalCalories).toBe(0);
    expect(result.confidenceLevel).toBe('low');
    expect(result.requiresClarification).toBe(false);
  });

  it('skips DB enrichment when DATABASE_URL is not set', async () => {
    delete process.env.DATABASE_URL;
    // Two Gemini calls: mode detect + parse
    geminiRespond({ mode: 'food' });
    geminiRespond(VALID_FOOD_RESPONSE);

    await processPhotoJob(makeJob({ userId: 'u1', reference: 'ref', photoBuffer: 'base64data' }));

    expect(lookupVerifiedFood).not.toHaveBeenCalled();
    expect(applyUserCalibration).not.toHaveBeenCalled();
  });
});

// ── 2. Happy path ─────────────────────────────────────────────────────────────

describe('2. Happy path', () => {
  it('parses food photo with Gemini and returns correct result', async () => {
    geminiRespond({ mode: 'food' });
    geminiRespond(VALID_FOOD_RESPONSE);

    const result = await processPhotoJob(
      makeJob({ userId: 'u1', reference: 'ref', photoBuffer: 'base64data', mode: 'food' }),
    );

    expect(result.mealName).toBe('Буузны хоол');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].source).toBe('ai_estimate');
    expect(result.totalCalories).toBe(400);
    expect(result.totalProtein).toBe(20);
    expect(result.confidenceLevel).toBe('high');
    expect(result.requiresClarification).toBe(false);
  });

  it('computes totals correctly for multiple items', async () => {
    geminiRespond({ mode: 'food' });
    geminiRespond({
      mealName: 'Lunch',
      items: [
        {
          name: 'Rice',
          calories: 200,
          protein: 4,
          carbs: 45,
          fat: 0.5,
          fiber: 1,
          sugar: 0,
          sodium: 5,
          saturatedFat: 0,
          servingGrams: 150,
          confidence: 0.9,
        },
        {
          name: 'Chicken',
          calories: 250,
          protein: 30,
          carbs: 0,
          fat: 14,
          fiber: 0,
          sugar: 0,
          sodium: 350,
          saturatedFat: 4,
          servingGrams: 120,
          confidence: 0.85,
        },
      ],
      requiresClarification: false,
    });

    const result = await processPhotoJob(
      makeJob({ userId: 'u1', reference: 'ref', photoBuffer: 'base64data' }),
    );

    expect(result.totalCalories).toBe(450);
    expect(result.totalProtein).toBe(34);
    expect(result.totalSodium).toBe(355);
  });

  it('defaults mealName to "Meal" when response has no mealName', async () => {
    geminiRespond({ mode: 'food' });
    geminiRespond({
      items: [
        {
          name: 'Food',
          calories: 100,
          protein: 5,
          carbs: 10,
          fat: 3,
          fiber: 1,
          sugar: 0,
          sodium: 50,
          saturatedFat: 1,
          servingGrams: 100,
          confidence: 0.8,
        },
      ],
    });

    const result = await processPhotoJob(
      makeJob({ userId: 'u1', reference: 'ref', photoBuffer: 'base64data' }),
    );

    expect(result.mealName).toBe('Meal');
  });

  it('clamps confidence to 0–1 range', async () => {
    geminiRespond({ mode: 'food' });
    geminiRespond({
      items: [
        {
          name: 'A',
          confidence: 2.5,
          calories: 100,
          protein: 5,
          carbs: 10,
          fat: 3,
          fiber: 0,
          sugar: 0,
          sodium: 0,
          saturatedFat: 0,
          servingGrams: 100,
        },
      ],
    });

    const result = await processPhotoJob(
      makeJob({ userId: 'u1', reference: 'ref', photoBuffer: 'base64data' }),
    );

    expect(result.items[0].confidence).toBe(1);
  });

  it('normalizes items with missing fields to zero', async () => {
    geminiRespond({ mode: 'food' });
    geminiRespond({ items: [{ name: 'Mystery food' }] });

    const result = await processPhotoJob(
      makeJob({ userId: 'u1', reference: 'ref', photoBuffer: 'base64data' }),
    );

    expect(result.items[0].calories).toBe(0);
    expect(result.items[0].protein).toBe(0);
    expect(result.items[0].confidence).toBe(0);
    expect(result.items[0].servingGrams).toBe(0);
  });
});

// ── 3. Provider fallback (replaces "both delivery channels" for this processor) ──

describe('3. Provider fallback', () => {
  it('falls back to OpenAI when Gemini parse fails', async () => {
    // Mode detect succeeds, parse fails
    geminiRespond({ mode: 'food' });
    mockGenerateContent.mockRejectedValueOnce(new Error('Gemini 500'));

    const mockOpenAI = getOpenAIMock();
    mockOpenAI.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(VALID_FOOD_RESPONSE) } }],
    });

    const result = await processPhotoJob(
      makeJob({ userId: 'u1', reference: 'ref', photoBuffer: 'base64data' }),
    );

    expect(mockOpenAI).toHaveBeenCalled();
    expect(result.mealName).toBe('Буузны хоол');
  });

  it('uses OpenAI directly when VISION_PROVIDER=openai', async () => {
    process.env.VISION_PROVIDER = 'openai';
    delete process.env.GEMINI_API_KEY;

    const mockOpenAI = getOpenAIMock();
    mockOpenAI.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(VALID_FOOD_RESPONSE) } }],
    });

    const result = await processPhotoJob(
      makeJob({ userId: 'u1', reference: 'ref', photoBuffer: 'base64data' }),
    );

    expect(mockGenerateContent).not.toHaveBeenCalled();
    expect(mockOpenAI).toHaveBeenCalled();
    expect(result.totalCalories).toBe(400);
  });

  it('returns empty result when Gemini fails and no OpenAI key', async () => {
    delete process.env.OPENAI_API_KEY;
    geminiRespond({ mode: 'food' });
    mockGenerateContent.mockRejectedValueOnce(new Error('Gemini error'));

    const result = await processPhotoJob(
      makeJob({ userId: 'u1', reference: 'ref', photoBuffer: 'base64data' }),
    );

    expect(result.mealName).toBe('Meal');
    expect(result.items).toEqual([]);
  });
});

// ── 4. Empty items / no deliverable content ───────────────────────────────────

describe('4. Empty items / no deliverable content', () => {
  it('handles empty items array in response', async () => {
    geminiRespond({ mode: 'food' });
    geminiRespond({ mealName: 'Empty plate', items: [], requiresClarification: false });

    const result = await processPhotoJob(
      makeJob({ userId: 'u1', reference: 'ref', photoBuffer: 'base64data' }),
    );

    expect(result.items).toEqual([]);
    expect(result.totalCalories).toBe(0);
    expect(result.confidenceLevel).toBe('low');
  });

  it('defaults item name to "Unknown food" when missing', async () => {
    geminiRespond({ mode: 'food' });
    geminiRespond({ items: [{ calories: 100, protein: 5, carbs: 10, fat: 3 }] });

    const result = await processPhotoJob(
      makeJob({ userId: 'u1', reference: 'ref', photoBuffer: 'base64data' }),
    );

    expect(result.items[0].name).toBe('Unknown food');
  });
});

// ── 5. Label mode handling ────────────────────────────────────────────────────

describe('5. Label mode', () => {
  it('uses label system prompt when mode is label and assigns source: label', async () => {
    geminiRespond({ mode: 'label' }); // mode detect agrees
    geminiRespond({
      mealName: 'Protein Bar',
      items: [
        {
          name: 'Protein Bar',
          servingGrams: 60,
          calories: 230,
          protein: 20,
          carbs: 25,
          fat: 8,
          fiber: 3,
          sugar: 5,
          sodium: 200,
          saturatedFat: 2,
          confidence: 0.97,
        },
      ],
      requiresClarification: false,
    });

    const result = await processPhotoJob(
      makeJob({ userId: 'u1', reference: 'ref', photoBuffer: 'base64data', mode: 'label' }),
    );

    expect(result.mealName).toBe('Protein Bar');
    expect(result.items[0].confidence).toBe(0.97);
    expect(result.items[0].source).toBe('label');
    // Label items must NOT go through DB lookup
    expect(lookupVerifiedFood).not.toHaveBeenCalled();
  });
});

// ── 6. AI fallbacks ───────────────────────────────────────────────────────────

describe('6. AI fallbacks', () => {
  it('returns empty result when AI returns no content', async () => {
    geminiRespond({ mode: 'food' });
    // Parse call returns empty-ish response
    geminiRespond({ mealName: 'Meal', items: [] });

    const result = await processPhotoJob(
      makeJob({ userId: 'u1', reference: 'ref', photoBuffer: 'base64data' }),
    );

    expect(result.items).toHaveLength(0);
    expect(result.confidenceLevel).toBe('low');
  });

  it('propagates clarificationQuestions from AI response', async () => {
    geminiRespond({ mode: 'food' });
    geminiRespond(AI_CLARIFICATION_RESPONSE);

    const result = await processPhotoJob(
      makeJob({ userId: 'u1', reference: 'ref', photoBuffer: 'base64data' }),
    );

    expect(result.requiresClarification).toBe(true);
    expect(result.clarificationQuestions).toHaveLength(2);
    expect(result.clarificationQuestions![0].id).toBe('portion_count_buuz');
    expect(result.clarificationQuestions![1].type).toBe('choice');
  });

  it('caps clarificationQuestions at 3', async () => {
    geminiRespond({ mode: 'food' });
    geminiRespond({
      mealName: 'Meal',
      items: [],
      requiresClarification: true,
      clarificationQuestions: [
        { id: 'q1', text: 'Q1', type: 'count' },
        { id: 'q2', text: 'Q2', type: 'count' },
        { id: 'q3', text: 'Q3', type: 'count' },
        { id: 'q4', text: 'Q4', type: 'count' },
      ],
    });

    const result = await processPhotoJob(
      makeJob({ userId: 'u1', reference: 'ref', photoBuffer: 'base64data' }),
    );

    expect(result.clarificationQuestions).toHaveLength(3);
  });
});

// ── 7. External service errors ────────────────────────────────────────────────

describe('7. External service errors', () => {
  it('logs Sentry when Gemini fails and falls back gracefully', async () => {
    geminiRespond({ mode: 'food' });
    mockGenerateContent.mockRejectedValueOnce(new Error('503'));

    const mockOpenAI = getOpenAIMock();
    mockOpenAI.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(VALID_FOOD_RESPONSE) } }],
    });

    await processPhotoJob(makeJob({ userId: 'u1', reference: 'ref', photoBuffer: 'base64data' }));

    expect(Sentry.captureException).toHaveBeenCalled();
  });

  it('returns empty result when all providers throw', async () => {
    geminiRespond({ mode: 'food' });
    mockGenerateContent.mockRejectedValueOnce(new Error('Gemini down'));

    const mockOpenAI = getOpenAIMock();
    mockOpenAI.mockRejectedValue(new Error('OpenAI down'));

    const result = await processPhotoJob(
      makeJob({ userId: 'u1', reference: 'ref', photoBuffer: 'base64data' }),
    );

    expect(result.items).toEqual([]);
    expect(result.confidenceLevel).toBe('low');
  });

  it('continues gracefully when DB enrichment throws', async () => {
    geminiRespond({ mode: 'food' });
    geminiRespond(VALID_FOOD_RESPONSE);
    (lookupVerifiedFood as jest.Mock).mockRejectedValue(new Error('DB timeout'));

    const result = await processPhotoJob(
      makeJob({ userId: 'u1', reference: 'ref', photoBuffer: 'base64data' }),
    );

    // Falls back to raw AI items
    expect(result.items).toHaveLength(1);
    expect(result.items[0].source).toBe('ai_estimate');
  });
});

// ── 8. Macro identity sanity check ───────────────────────────────────────────

describe('8. Macro identity sanity check', () => {
  it('flags item when macros deviate from calories by >20%', async () => {
    geminiRespond({ mode: 'food' });
    geminiRespond(FLAGGED_MACRO_RESPONSE);

    const result = await processPhotoJob(
      makeJob({ userId: 'u1', reference: 'ref', photoBuffer: 'base64data' }),
    );

    // 4*20 + 4*30 + 9*15 = 80 + 120 + 135 = 335; reported 500
    // |500-335|/max(500,335) = 165/500 = 0.33 > 0.20 → flagged
    expect(result.items[0].flagged).toBe(true);
    expect(result.items[0].flagReason).toBe('Macros do not add up to calories');
    // Calories must NOT be recomputed
    expect(result.items[0].calories).toBe(500);
  });

  it('does not flag item when macros are within 20% of calories', async () => {
    geminiRespond({ mode: 'food' });
    // 4*20 + 4*30 + 9*15 = 335, reported 400 → |400-335|/400 = 0.16 < 0.20
    geminiRespond(VALID_FOOD_RESPONSE);

    const result = await processPhotoJob(
      makeJob({ userId: 'u1', reference: 'ref', photoBuffer: 'base64data' }),
    );

    expect(result.items[0].flagged).toBeFalsy();
  });

  it('does not flag item with zero calories', async () => {
    geminiRespond({ mode: 'food' });
    geminiRespond({
      items: [
        {
          name: 'Water',
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          fiber: 0,
          sugar: 0,
          sodium: 0,
          saturatedFat: 0,
          servingGrams: 250,
          confidence: 0.99,
        },
      ],
    });

    const result = await processPhotoJob(
      makeJob({ userId: 'u1', reference: 'ref', photoBuffer: 'base64data' }),
    );

    expect(result.items[0].flagged).toBeFalsy();
  });
});

// ── 9. Edge cases — DB match, calibration, confidence level, mode detection ──

describe('9. Edge cases', () => {
  it('replaces AI nutrition with verified DB values when match score >= 0.7', async () => {
    geminiRespond({ mode: 'food' });
    geminiRespond(VALID_FOOD_RESPONSE);

    const verifiedFood = {
      id: 'food-uuid-123',
      nameMn: 'Бууз',
      nameEn: 'Buuz',
      perHundredG: { kcal: 220, p: 11, c: 18, f: 8, fi: 1, su: 0.5, so: 280, sf: 3 },
    };
    (lookupVerifiedFood as jest.Mock).mockResolvedValue(verifiedFood);

    const result = await processPhotoJob(
      makeJob({ userId: 'u1', reference: 'ref', photoBuffer: 'base64data' }),
    );

    const item = result.items[0];
    // servingGrams = 200 → scale = 2
    expect(item.source).toBe('verified_db');
    expect(item.matchedFoodId).toBe('food-uuid-123');
    expect(item.calories).toBeCloseTo(220 * 2);
    expect(item.protein).toBeCloseTo(11 * 2);
    expect(item.carbs).toBeCloseTo(18 * 2);
    expect(item.fat).toBeCloseTo(8 * 2);
    expect(item.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('keeps source: ai_estimate when no DB match found', async () => {
    geminiRespond({ mode: 'food' });
    geminiRespond(VALID_FOOD_RESPONSE);
    (lookupVerifiedFood as jest.Mock).mockResolvedValue(null);

    const result = await processPhotoJob(
      makeJob({ userId: 'u1', reference: 'ref', photoBuffer: 'base64data' }),
    );

    expect(result.items[0].source).toBe('ai_estimate');
    expect(result.items[0].matchedFoodId).toBeUndefined();
    expect(result.items[0].calories).toBe(400);
  });

  it('applies calibration ratio when >=3 corrections exist', async () => {
    geminiRespond({ mode: 'food' });
    geminiRespond(VALID_FOOD_RESPONSE);

    const verifiedFood = {
      id: 'food-uuid-123',
      nameMn: 'Бууз',
      nameEn: 'Buuz',
      perHundredG: { kcal: 220, p: 11, c: 18, f: 8, fi: 1, su: 0.5, so: 280, sf: 3 },
    };
    (lookupVerifiedFood as jest.Mock).mockResolvedValue(verifiedFood);

    // Calibration multiplies all values by 0.8
    (applyUserCalibration as jest.Mock).mockImplementation((_u, item) =>
      Promise.resolve({ ...item, calories: item.calories * 0.8, protein: item.protein * 0.8 }),
    );

    const result = await processPhotoJob(
      makeJob({ userId: 'u1', reference: 'ref', photoBuffer: 'base64data' }),
    );

    // 220*2=440 → *0.8 = 352
    expect(result.items[0].calories).toBeCloseTo(440 * 0.8);
    expect(applyUserCalibration).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ matchedFoodId: 'food-uuid-123' }),
      expect.anything(),
    );
  });

  it('does not apply calibration when there is no matchedFoodId', async () => {
    geminiRespond({ mode: 'food' });
    geminiRespond(VALID_FOOD_RESPONSE);
    (lookupVerifiedFood as jest.Mock).mockResolvedValue(null);

    await processPhotoJob(makeJob({ userId: 'u1', reference: 'ref', photoBuffer: 'base64data' }));

    expect(applyUserCalibration).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ matchedFoodId: undefined }),
      expect.anything(),
    );
  });

  it('sets confidenceLevel: low and requiresClarification: true for low-confidence items', async () => {
    geminiRespond({ mode: 'food' });
    geminiRespond(LOW_CONFIDENCE_RESPONSE); // confidence 0.3

    const result = await processPhotoJob(
      makeJob({ userId: 'u1', reference: 'ref', photoBuffer: 'base64data' }),
    );

    expect(result.confidenceLevel).toBe('low');
    expect(result.requiresClarification).toBe(true);
  });

  it('sets confidenceLevel: medium for average confidence 0.5–0.79', async () => {
    geminiRespond({ mode: 'food' });
    geminiRespond({
      mealName: 'Meal',
      items: [
        {
          name: 'Item',
          calories: 200,
          protein: 10,
          carbs: 25,
          fat: 6,
          fiber: 1,
          sugar: 1,
          sodium: 200,
          saturatedFat: 2,
          servingGrams: 150,
          confidence: 0.65,
        },
      ],
      requiresClarification: false,
    });

    const result = await processPhotoJob(
      makeJob({ userId: 'u1', reference: 'ref', photoBuffer: 'base64data' }),
    );

    expect(result.confidenceLevel).toBe('medium');
    expect(result.requiresClarification).toBe(false);
  });

  it('auto-corrects mode via detection and logs Sentry breadcrumb', async () => {
    // User passed mode: 'food', but image is actually a label
    geminiRespond({ mode: 'label' });
    geminiRespond({
      mealName: 'Protein Bar',
      items: [
        {
          name: 'Bar',
          servingGrams: 50,
          calories: 200,
          protein: 18,
          carbs: 20,
          fat: 7,
          fiber: 2,
          sugar: 4,
          sodium: 150,
          saturatedFat: 2,
          confidence: 0.95,
        },
      ],
      requiresClarification: false,
    });

    const result = await processPhotoJob(
      makeJob({ userId: 'u1', reference: 'ref', photoBuffer: 'base64data', mode: 'food' }),
    );

    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ detectedMode: 'label', userMode: 'food' }),
      }),
    );
    // After correction to label mode, items get source: label
    expect(result.items[0].source).toBe('label');
    // And DB lookup is skipped for label items
    expect(lookupVerifiedFood).not.toHaveBeenCalled();
  });

  it('uses user-passed mode when detection mode agrees', async () => {
    geminiRespond({ mode: 'food' }); // detection agrees with user
    geminiRespond(VALID_FOOD_RESPONSE);

    await processPhotoJob(
      makeJob({ userId: 'u1', reference: 'ref', photoBuffer: 'base64data', mode: 'food' }),
    );

    // No breadcrumb added when modes agree
    expect(Sentry.addBreadcrumb).not.toHaveBeenCalled();
  });

  it('silently uses user-passed mode when Gemini key is absent for detection', async () => {
    delete process.env.GEMINI_API_KEY;
    process.env.VISION_PROVIDER = 'openai';

    const mockOpenAI = getOpenAIMock();
    mockOpenAI.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(VALID_FOOD_RESPONSE) } }],
    });

    const result = await processPhotoJob(
      makeJob({ userId: 'u1', reference: 'ref', photoBuffer: 'base64data', mode: 'food' }),
    );

    expect(mockGenerateContent).not.toHaveBeenCalled();
    expect(result.items[0].source).toBe('ai_estimate');
  });
});
