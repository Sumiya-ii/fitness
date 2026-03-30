/**
 * Unit tests for the Photo (vision-based nutrition parsing) processor.
 */

jest.mock('openai', () => {
  const mockCreate = jest.fn();
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }));
});

jest.mock('@google/generative-ai', () => {
  const mockGenerateContent = jest.fn();
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockReturnValue({
        generateContent: mockGenerateContent,
      }),
    })),
    __mockGenerateContent: mockGenerateContent,
  };
});

import { processPhotoJob } from './photo.processor';
import OpenAI from 'openai';
import type { Job } from 'bullmq';

function getOpenAIMock(): jest.Mock {
  const instance = new (OpenAI as unknown as new () => {
    chat: { completions: { create: jest.Mock } };
  })();
  return instance.chat.completions.create;
}

function getGeminiMock(): jest.Mock {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  return require('@google/generative-ai').__mockGenerateContent;
}

function makeJob(data: Record<string, unknown>): Job {
  return { id: 'job-1', name: 'photo', data } as unknown as Job;
}

const VALID_GEMINI_RESPONSE = {
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
};

let originalEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  jest.clearAllMocks();
  originalEnv = { ...process.env };
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  process.env.OPENAI_API_KEY = 'test-openai-key';
  process.env.VISION_PROVIDER = 'gemini';
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  process.env = originalEnv;
  jest.restoreAllMocks();
});

describe('processPhotoJob', () => {
  it('returns empty result when no API keys are configured', async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const result = await processPhotoJob(
      makeJob({ userId: 'u1', reference: 'ref', photoBuffer: 'base64data' }),
    );

    expect(result.mealName).toBe('Meal');
    expect(result.items).toEqual([]);
    expect(result.totalCalories).toBe(0);
  });

  it('uses Gemini as primary provider', async () => {
    const mockGemini = getGeminiMock();
    mockGemini.mockResolvedValue({
      response: { text: () => JSON.stringify(VALID_GEMINI_RESPONSE) },
    });

    const result = await processPhotoJob(
      makeJob({ userId: 'u1', reference: 'ref', photoBuffer: 'base64data', mode: 'food' }),
    );

    expect(mockGemini).toHaveBeenCalled();
    expect(result.mealName).toBe('Буузны хоол');
    expect(result.items).toHaveLength(1);
    expect(result.totalCalories).toBe(400);
    expect(result.totalProtein).toBe(20);
  });

  it('falls back to OpenAI when Gemini fails', async () => {
    const mockGemini = getGeminiMock();
    mockGemini.mockRejectedValue(new Error('Gemini 500'));

    const mockOpenAI = getOpenAIMock();
    mockOpenAI.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(VALID_GEMINI_RESPONSE) } }],
    });

    const result = await processPhotoJob(
      makeJob({ userId: 'u1', reference: 'ref', photoBuffer: 'base64data' }),
    );

    expect(mockGemini).toHaveBeenCalled();
    expect(mockOpenAI).toHaveBeenCalled();
    expect(result.mealName).toBe('Буузны хоол');
  });

  it('uses OpenAI directly when provider is not gemini', async () => {
    process.env.VISION_PROVIDER = 'openai';

    const mockOpenAI = getOpenAIMock();
    mockOpenAI.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(VALID_GEMINI_RESPONSE) } }],
    });

    const result = await processPhotoJob(
      makeJob({ userId: 'u1', reference: 'ref', photoBuffer: 'base64data' }),
    );

    expect(getGeminiMock()).not.toHaveBeenCalled();
    expect(mockOpenAI).toHaveBeenCalled();
    expect(result.totalCalories).toBe(400);
  });

  it('uses label system prompt when mode is label', async () => {
    const mockGemini = getGeminiMock();
    mockGemini.mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify({
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
          }),
      },
    });

    const result = await processPhotoJob(
      makeJob({ userId: 'u1', reference: 'ref', photoBuffer: 'base64data', mode: 'label' }),
    );

    expect(result.mealName).toBe('Protein Bar');
    expect(result.items[0].confidence).toBe(0.97);
  });

  it('normalizes items with missing fields to zero', async () => {
    const mockGemini = getGeminiMock();
    mockGemini.mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify({
            items: [{ name: 'Mystery food' }],
          }),
      },
    });

    const result = await processPhotoJob(
      makeJob({ userId: 'u1', reference: 'ref', photoBuffer: 'base64data' }),
    );

    expect(result.items[0].calories).toBe(0);
    expect(result.items[0].protein).toBe(0);
    expect(result.items[0].confidence).toBe(0);
    expect(result.items[0].servingGrams).toBe(0);
  });

  it('clamps confidence to 0–1 range', async () => {
    const mockGemini = getGeminiMock();
    mockGemini.mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify({
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
          }),
      },
    });

    const result = await processPhotoJob(
      makeJob({ userId: 'u1', reference: 'ref', photoBuffer: 'base64data' }),
    );

    expect(result.items[0].confidence).toBe(1);
  });

  it('computes totals correctly for multiple items', async () => {
    const mockGemini = getGeminiMock();
    mockGemini.mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify({
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
          }),
      },
    });

    const result = await processPhotoJob(
      makeJob({ userId: 'u1', reference: 'ref', photoBuffer: 'base64data' }),
    );

    expect(result.totalCalories).toBe(450);
    expect(result.totalProtein).toBe(34);
    expect(result.totalSodium).toBe(355);
  });

  it('returns empty result when Gemini fails and no OpenAI key', async () => {
    delete process.env.OPENAI_API_KEY;

    const mockGemini = getGeminiMock();
    mockGemini.mockRejectedValue(new Error('Gemini error'));

    const result = await processPhotoJob(
      makeJob({ userId: 'u1', reference: 'ref', photoBuffer: 'base64data' }),
    );

    expect(result.mealName).toBe('Meal');
    expect(result.items).toEqual([]);
  });

  it('defaults mealName to "Meal" when response has no mealName', async () => {
    const mockGemini = getGeminiMock();
    mockGemini.mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify({
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
          }),
      },
    });

    const result = await processPhotoJob(
      makeJob({ userId: 'u1', reference: 'ref', photoBuffer: 'base64data' }),
    );

    expect(result.mealName).toBe('Meal');
  });

  it('handles empty items array in response', async () => {
    const mockGemini = getGeminiMock();
    mockGemini.mockResolvedValue({
      response: { text: () => JSON.stringify({ mealName: 'Empty plate', items: [] }) },
    });

    const result = await processPhotoJob(
      makeJob({ userId: 'u1', reference: 'ref', photoBuffer: 'base64data' }),
    );

    expect(result.items).toEqual([]);
    expect(result.totalCalories).toBe(0);
  });

  it('defaults item name to "Unknown food" when missing', async () => {
    const mockGemini = getGeminiMock();
    mockGemini.mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify({
            items: [{ calories: 100, protein: 5, carbs: 10, fat: 3 }],
          }),
      },
    });

    const result = await processPhotoJob(
      makeJob({ userId: 'u1', reference: 'ref', photoBuffer: 'base64data' }),
    );

    expect(result.items[0].name).toBe('Unknown food');
  });
});
