/**
 * Unit tests for the Coach Memory processor.
 */

const mockPoolQuery = jest.fn();
const mockPoolEnd = jest.fn();
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: mockPoolQuery,
    end: mockPoolEnd,
  })),
}));

jest.mock('openai', () => {
  const mockCreate = jest.fn();
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }));
});

import { processCoachMemoryJob } from './coach-memory.processor';
import OpenAI from 'openai';
import type { Job } from 'bullmq';

function getOpenAIMock(): jest.Mock {
  const instance = new (OpenAI as unknown as new () => {
    chat: { completions: { create: jest.Mock } };
  })();
  return instance.chat.completions.create;
}

function makeJob(overrides: Record<string, unknown> = {}): Job {
  return {
    id: 'job-1',
    name: 'coach-memory',
    data: { userId: 'u1', locale: 'mn', ...overrides },
  } as unknown as Job;
}

let originalEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  jest.clearAllMocks();
  originalEnv = { ...process.env };
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.DATABASE_URL = 'postgres://localhost/test';
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  process.env = originalEnv;
  jest.restoreAllMocks();
});

function setupAggregationMocks() {
  // Mock the 7 parallel queries in aggregateUserData
  mockPoolQuery
    // topFoods
    .mockResolvedValueOnce({ rows: [{ name: 'Бууз', freq: '15' }] })
    // calsByDow
    .mockResolvedValueOnce({ rows: [{ dow: '1', avg_cals: '1800' }] })
    // proteinByPeriod
    .mockResolvedValueOnce({ rows: [{ period: 'weekday', avg_protein: '85.5' }] })
    // daysLogged
    .mockResolvedValueOnce({ rows: [{ days_logged: '22' }] })
    // mealTypes
    .mockResolvedValueOnce({ rows: [{ meal_type: 'lunch', count: '30' }] })
    // weights
    .mockResolvedValueOnce({
      rows: [
        { weight_kg: '80.0', logged_at: new Date() },
        { weight_kg: '78.5', logged_at: new Date() },
      ],
    })
    // profile
    .mockResolvedValueOnce({
      rows: [
        {
          display_name: 'Болд',
          goal_weight_kg: '75',
          calorie_target: '2000',
          protein_grams: '120',
          goal_type: 'lose_weight',
        },
      ],
    });
}

describe('processCoachMemoryJob', () => {
  it('skips when OPENAI_API_KEY is not set', async () => {
    delete process.env.OPENAI_API_KEY;

    await processCoachMemoryJob(makeJob());

    expect(mockPoolQuery).not.toHaveBeenCalled();
  });

  it('skips when DATABASE_URL is not set', async () => {
    delete process.env.DATABASE_URL;

    await processCoachMemoryJob(makeJob());

    expect(mockPoolQuery).not.toHaveBeenCalled();
  });

  it('aggregates data and generates memory summaries', async () => {
    setupAggregationMocks();

    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              foods: 'Favorite food is бууз (15x in 30 days).',
              patterns: 'Logs meals on weekdays consistently.',
              goals: 'Targeting 2000 kcal/day, losing weight steadily.',
              preferences: 'Prefers traditional Mongolian foods.',
            }),
          },
        },
      ],
    });

    // Mock the 4 upsert queries
    mockPoolQuery.mockResolvedValue({ rows: [] });

    await processCoachMemoryJob(makeJob());

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-4o-mini', temperature: 0.3, max_tokens: 400 }),
    );

    // 7 aggregation queries + 4 upserts = 11 total
    expect(mockPoolQuery).toHaveBeenCalledTimes(11);

    // Verify upsert calls include all 4 categories
    const upsertCalls = mockPoolQuery.mock.calls.slice(7);
    const categories = upsertCalls.map((call) => call[1][1]);
    expect(categories).toEqual(
      expect.arrayContaining(['foods', 'patterns', 'goals', 'preferences']),
    );

    expect(mockPoolEnd).toHaveBeenCalled();
  });

  it('uses fallback summaries when GPT returns partial data', async () => {
    setupAggregationMocks();

    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '{"foods":"Some food data"}' } }],
    });

    mockPoolQuery.mockResolvedValue({ rows: [] });

    await processCoachMemoryJob(makeJob());

    // Check that upserts still happen for all 4 categories
    const upsertCalls = mockPoolQuery.mock.calls.slice(7);
    expect(upsertCalls).toHaveLength(4);
  });

  it('throws and cleans up pool on aggregation error', async () => {
    mockPoolQuery.mockRejectedValue(new Error('DB connection failed'));

    await expect(processCoachMemoryJob(makeJob())).rejects.toThrow('DB connection failed');
    expect(mockPoolEnd).toHaveBeenCalled();
  });

  it('throws and cleans up pool on OpenAI error', async () => {
    setupAggregationMocks();

    const mockCreate = getOpenAIMock();
    mockCreate.mockRejectedValue(new Error('OpenAI 500'));

    await expect(processCoachMemoryJob(makeJob())).rejects.toThrow('OpenAI 500');
    expect(mockPoolEnd).toHaveBeenCalled();
  });

  it('handles empty database results gracefully', async () => {
    // All 7 queries return empty rows
    for (let i = 0; i < 7; i++) {
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });
    }

    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              foods: 'No data yet.',
              patterns: 'No data yet.',
              goals: 'No data yet.',
              preferences: 'No data yet.',
            }),
          },
        },
      ],
    });

    // Upserts
    mockPoolQuery.mockResolvedValue({ rows: [] });

    await processCoachMemoryJob(makeJob());

    // Should still generate and upsert summaries even with empty data
    expect(mockCreate).toHaveBeenCalled();
    expect(mockPoolQuery).toHaveBeenCalledTimes(11);
  });

  it('handles GPT returning empty JSON object', async () => {
    setupAggregationMocks();

    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '{}' } }],
    });

    mockPoolQuery.mockResolvedValue({ rows: [] });

    await processCoachMemoryJob(makeJob());

    // Should use fallback strings for all categories
    const upsertCalls = mockPoolQuery.mock.calls.slice(7);
    const summaries = upsertCalls.map((call) => call[1][2]);
    summaries.forEach((summary: string) => {
      expect(summary).toContain('байхгүй байна');
    });
  });

  it('handles weight logs with identical start and end values', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [{ name: 'Rice', freq: '5' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ days_logged: '10' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          { weight_kg: '75.0', logged_at: new Date() },
          { weight_kg: '75.0', logged_at: new Date() },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              foods: 'Eats rice.',
              patterns: 'Consistent.',
              goals: 'Maintaining.',
              preferences: 'Simple foods.',
            }),
          },
        },
      ],
    });

    mockPoolQuery.mockResolvedValue({ rows: [] });

    await processCoachMemoryJob(makeJob());

    // GPT prompt should contain "0.0kg change"
    const gptCall = mockCreate.mock.calls[0];
    const userMessage = gptCall[0].messages[1].content;
    expect(userMessage).toContain('0.0kg change');
  });
});
