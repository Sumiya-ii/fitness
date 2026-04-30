/**
 * Unit tests for the Coach Memory processor.
 * Tests the derived-fact pipeline — GPT is only a formatter, not a source of truth.
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

/**
 * Sets up the 5 parallel deriveFacts queries in order:
 * topFoods, weightResult, kcalResult, streakResult, profileResult
 */
function setupDerivationMocks(
  overrides: {
    topFoods?: Array<{ name: string; freq: string }>;
    weights?: Array<{ weight_kg: string }>;
    avgKcal?: string | null;
    streak?: string;
    profile?: { goal_type: string | null; calorie_target: string | null } | null;
  } = {},
) {
  const {
    topFoods = [
      { name: 'Бууз', freq: '8' },
      { name: 'Цуйван', freq: '5' },
    ],
    weights = [{ weight_kg: '82.0' }, { weight_kg: '80.5' }],
    avgKcal = '1850',
    streak = '10',
    profile = { goal_type: 'lose_weight', calorie_target: '2000' },
  } = overrides;

  mockPoolQuery
    .mockResolvedValueOnce({ rows: topFoods })
    .mockResolvedValueOnce({ rows: weights })
    .mockResolvedValueOnce({ rows: avgKcal ? [{ avg_kcal: avgKcal }] : [] })
    .mockResolvedValueOnce({ rows: [{ streak }] })
    .mockResolvedValueOnce({ rows: profile ? [profile] : [] });
}

function setupGptSuccess(mockCreate: jest.Mock) {
  mockCreate.mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            foods: 'Бууз (8x), Цуйван (5x).',
            patterns: '10/14 өдөр бүртгэсэн.',
            goals: 'Жин хасах зорилготой.',
            preferences: 'Бууз хамгийн их.',
          }),
        },
      },
    ],
  });
}

// ── 1. Missing env vars ───────────────────────────────────────────────────────

describe('missing env vars', () => {
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
});

// ── 2. Empty data / new user — no GPT call ────────────────────────────────────

describe('empty data (new user)', () => {
  it('returns early with no GPT call when all queries return empty', async () => {
    // All 5 derivation queries return empty
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [] }) // topFoods
      .mockResolvedValueOnce({ rows: [] }) // weights
      .mockResolvedValueOnce({ rows: [] }) // kcal
      .mockResolvedValueOnce({ rows: [{ streak: '0' }] }) // streak=0
      .mockResolvedValueOnce({ rows: [] }); // profile

    const mockCreate = getOpenAIMock();
    await processCoachMemoryJob(makeJob());

    // No GPT call and no upsert queries — graceful skip
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockPoolQuery).toHaveBeenCalledTimes(5);
    expect(mockPoolEnd).toHaveBeenCalled();
  });
});

// ── 3. Happy path — derived facts populated correctly ─────────────────────────

describe('happy path', () => {
  it('derives facts and upserts all 4 categories', async () => {
    setupDerivationMocks();
    const mockCreate = getOpenAIMock();
    setupGptSuccess(mockCreate);
    mockPoolQuery.mockResolvedValue({ rows: [] }); // upserts

    await processCoachMemoryJob(makeJob());

    // 5 derivation + 4 upserts = 9 total
    expect(mockPoolQuery).toHaveBeenCalledTimes(9);

    const upsertCalls = mockPoolQuery.mock.calls.slice(5);
    const categories = upsertCalls.map((call) => call[1][1]);
    expect(categories).toEqual(
      expect.arrayContaining(['foods', 'patterns', 'goals', 'preferences']),
    );

    expect(mockPoolEnd).toHaveBeenCalled();
  });

  it('passes derived evidence numbers to GPT, not freeform text', async () => {
    setupDerivationMocks();
    const mockCreate = getOpenAIMock();
    setupGptSuccess(mockCreate);
    mockPoolQuery.mockResolvedValue({ rows: [] });

    await processCoachMemoryJob(makeJob());

    const gptCall = mockCreate.mock.calls[0];
    const userMessage: string = gptCall[0].messages[1].content;

    // Evidence block must contain raw derived numbers
    expect(userMessage).toContain('Бууз');
    expect(userMessage).toContain('"weightTrendKg"');
    expect(userMessage).toContain('"streak"');
    expect(userMessage).toContain('"goalType"');
  });

  it('GPT prompt system instruction forbids fabrication', async () => {
    setupDerivationMocks();
    const mockCreate = getOpenAIMock();
    setupGptSuccess(mockCreate);
    mockPoolQuery.mockResolvedValue({ rows: [] });

    await processCoachMemoryJob(makeJob());

    const systemMessage: string = mockCreate.mock.calls[0][0].messages[0].content;
    expect(systemMessage).toContain('Only state what is in the data provided');
    expect(systemMessage).toContain('Do not infer');
  });

  it('uses low temperature (0.1) to minimize GPT creativity', async () => {
    setupDerivationMocks();
    const mockCreate = getOpenAIMock();
    setupGptSuccess(mockCreate);
    mockPoolQuery.mockResolvedValue({ rows: [] });

    await processCoachMemoryJob(makeJob());

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ temperature: 0.1 }));
  });
});

// ── 4. Weight trend edge cases ────────────────────────────────────────────────

describe('weight trend', () => {
  it('includes weight delta when >= 2 entries', async () => {
    setupDerivationMocks({
      weights: [{ weight_kg: '85.0' }, { weight_kg: '83.0' }],
    });
    const mockCreate = getOpenAIMock();
    setupGptSuccess(mockCreate);
    mockPoolQuery.mockResolvedValue({ rows: [] });

    await processCoachMemoryJob(makeJob());

    const userMessage: string = mockCreate.mock.calls[0][0].messages[1].content;
    expect(userMessage).toContain('"weightTrendKg":-2');
  });

  it('skips weight trend when < 2 entries', async () => {
    setupDerivationMocks({ weights: [{ weight_kg: '80.0' }] });
    const mockCreate = getOpenAIMock();
    setupGptSuccess(mockCreate);
    mockPoolQuery.mockResolvedValue({ rows: [] });

    await processCoachMemoryJob(makeJob());

    const userMessage: string = mockCreate.mock.calls[0][0].messages[1].content;
    expect(userMessage).toContain('"weightTrendKg":null');
  });

  it('skips weight trend when weight_logs is empty', async () => {
    setupDerivationMocks({ weights: [] });
    const mockCreate = getOpenAIMock();
    setupGptSuccess(mockCreate);
    mockPoolQuery.mockResolvedValue({ rows: [] });

    await processCoachMemoryJob(makeJob());

    const userMessage: string = mockCreate.mock.calls[0][0].messages[1].content;
    expect(userMessage).toContain('"weightTrendKg":null');
  });
});

// ── 5. Kcal adherence edge cases ──────────────────────────────────────────────

describe('kcal adherence', () => {
  it('skips kcal adherence when calorie target is zero', async () => {
    setupDerivationMocks({
      profile: { goal_type: 'maintain', calorie_target: '0' },
    });
    const mockCreate = getOpenAIMock();
    setupGptSuccess(mockCreate);
    mockPoolQuery.mockResolvedValue({ rows: [] });

    await processCoachMemoryJob(makeJob());

    const userMessage: string = mockCreate.mock.calls[0][0].messages[1].content;
    expect(userMessage).toContain('"kcalAdherence":null');
  });

  it('skips kcal adherence when calorie target is null', async () => {
    setupDerivationMocks({
      profile: { goal_type: 'maintain', calorie_target: null },
    });
    const mockCreate = getOpenAIMock();
    setupGptSuccess(mockCreate);
    mockPoolQuery.mockResolvedValue({ rows: [] });

    await processCoachMemoryJob(makeJob());

    const userMessage: string = mockCreate.mock.calls[0][0].messages[1].content;
    expect(userMessage).toContain('"kcalAdherence":null');
  });

  it('includes kcal adherence when both avg kcal and target are present', async () => {
    setupDerivationMocks({
      avgKcal: '1850',
      profile: { goal_type: 'lose_weight', calorie_target: '2000' },
    });
    const mockCreate = getOpenAIMock();
    setupGptSuccess(mockCreate);
    mockPoolQuery.mockResolvedValue({ rows: [] });

    await processCoachMemoryJob(makeJob());

    const userMessage: string = mockCreate.mock.calls[0][0].messages[1].content;
    expect(userMessage).toContain('"avgKcal":1850');
    expect(userMessage).toContain('"target":2000');
  });
});

// ── 6. AI fallback when GPT fails or returns partial data ─────────────────────

describe('AI fallback', () => {
  it('uses derived summaries when GPT returns empty object', async () => {
    setupDerivationMocks();
    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '{}' } }],
    });
    mockPoolQuery.mockResolvedValue({ rows: [] });

    await processCoachMemoryJob(makeJob());

    // Upserts still happen — derived strings used as fallback
    const upsertCalls = mockPoolQuery.mock.calls.slice(5);
    expect(upsertCalls).toHaveLength(4);
    // Derived foods summary should contain the top food name
    const foodsSummary = upsertCalls.find((c) => c[1][1] === 'foods')?.[1][2] as string;
    expect(foodsSummary).toContain('Бууз');
  });

  it('uses derived summaries when GPT throws an error', async () => {
    setupDerivationMocks();
    const mockCreate = getOpenAIMock();
    mockCreate.mockRejectedValue(new Error('OpenAI 500'));
    mockPoolQuery.mockResolvedValue({ rows: [] });

    // Should not throw — GPT failure is non-fatal
    await expect(processCoachMemoryJob(makeJob())).resolves.toBeUndefined();

    const upsertCalls = mockPoolQuery.mock.calls.slice(5);
    expect(upsertCalls).toHaveLength(4);
  });

  it('uses derived summaries when GPT returns partial keys', async () => {
    setupDerivationMocks();
    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '{"foods":"Some foods"}' } }],
    });
    mockPoolQuery.mockResolvedValue({ rows: [] });

    await processCoachMemoryJob(makeJob());

    // All 4 upserts must still happen
    const upsertCalls = mockPoolQuery.mock.calls.slice(5);
    expect(upsertCalls).toHaveLength(4);
  });
});

// ── 7. External service errors ────────────────────────────────────────────────

describe('external service errors', () => {
  it('throws and cleans up pool when DB query fails', async () => {
    mockPoolQuery.mockRejectedValue(new Error('DB connection failed'));

    await expect(processCoachMemoryJob(makeJob())).rejects.toThrow('DB connection failed');
    expect(mockPoolEnd).toHaveBeenCalled();
  });
});

// ── 8. Goal type ──────────────────────────────────────────────────────────────

describe('goal type', () => {
  it('includes goal type from profile when set', async () => {
    setupDerivationMocks({ profile: { goal_type: 'gain_muscle', calorie_target: '2500' } });
    const mockCreate = getOpenAIMock();
    setupGptSuccess(mockCreate);
    mockPoolQuery.mockResolvedValue({ rows: [] });

    await processCoachMemoryJob(makeJob());

    const userMessage: string = mockCreate.mock.calls[0][0].messages[1].content;
    expect(userMessage).toContain('"goalType":"gain_muscle"');
  });

  it('passes null goalType when profile has no goal_type', async () => {
    setupDerivationMocks({ profile: { goal_type: null, calorie_target: '2000' } });
    const mockCreate = getOpenAIMock();
    setupGptSuccess(mockCreate);
    mockPoolQuery.mockResolvedValue({ rows: [] });

    await processCoachMemoryJob(makeJob());

    const userMessage: string = mockCreate.mock.calls[0][0].messages[1].content;
    expect(userMessage).toContain('"goalType":null');
  });
});

// ── 9. Edge case data ─────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('handles zero streak (no meals logged)', async () => {
    setupDerivationMocks({ topFoods: [{ name: 'Бууз', freq: '1' }], streak: '0' });
    const mockCreate = getOpenAIMock();
    setupGptSuccess(mockCreate);
    mockPoolQuery.mockResolvedValue({ rows: [] });

    await processCoachMemoryJob(makeJob());

    expect(mockPoolQuery).toHaveBeenCalledTimes(9);
  });

  it('produces English summaries when locale is en', async () => {
    setupDerivationMocks();
    const mockCreate = getOpenAIMock();
    setupGptSuccess(mockCreate);
    mockPoolQuery.mockResolvedValue({ rows: [] });

    await processCoachMemoryJob(makeJob({ locale: 'en' }));

    // System prompt must request English
    const systemMessage: string = mockCreate.mock.calls[0][0].messages[0].content;
    expect(systemMessage).toContain('English');
  });

  it('defaults to Mongolian for undefined locale', async () => {
    setupDerivationMocks();
    const mockCreate = getOpenAIMock();
    setupGptSuccess(mockCreate);
    mockPoolQuery.mockResolvedValue({ rows: [] });

    await processCoachMemoryJob(makeJob({ locale: undefined }));

    const systemMessage: string = mockCreate.mock.calls[0][0].messages[0].content;
    expect(systemMessage).toContain('Mongolian');
  });

  it('handles missing profile row gracefully', async () => {
    setupDerivationMocks({ profile: null });
    const mockCreate = getOpenAIMock();
    setupGptSuccess(mockCreate);
    mockPoolQuery.mockResolvedValue({ rows: [] });

    await processCoachMemoryJob(makeJob());

    expect(mockPoolQuery).toHaveBeenCalledTimes(9);
  });
});
