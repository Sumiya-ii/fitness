/**
 * Unit tests for the Meal Timing Insights processor.
 */

jest.mock('../expo-push', () => ({ sendExpoPush: jest.fn() }));
jest.mock('../message-log.service', () => ({ logMessage: jest.fn() }));
jest.mock('telegraf', () => ({
  Telegraf: jest.fn().mockImplementation(() => ({
    telegram: { sendMessage: jest.fn().mockResolvedValue(undefined) },
  })),
}));

jest.mock('openai', () => {
  const mockCreate = jest.fn();
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }));
});

import { processMealTimingJob } from './meal-timing.processor';
import { sendExpoPush } from '../expo-push';
import { logMessage } from '../message-log.service';
import { Telegraf } from 'telegraf';
import OpenAI from 'openai';
import type { Job } from 'bullmq';

const mockSendExpoPush = sendExpoPush as jest.MockedFunction<typeof sendExpoPush>;
const mockLogMessage = logMessage as jest.MockedFunction<typeof logMessage>;

function getOpenAIMock(): jest.Mock {
  const instance = new (OpenAI as unknown as new () => {
    chat: { completions: { create: jest.Mock } };
  })();
  return instance.chat.completions.create;
}

const BASE_INSIGHTS = {
  weekStart: '2026-03-22',
  weekEnd: '2026-03-28',
  mealStats: [
    { mealType: 'breakfast', avgHour: 8.5, count: 4 },
    { mealType: 'lunch', avgHour: 12.75, count: 6 },
    { mealType: 'dinner', avgHour: 19.25, count: 5 },
  ],
  breakfastWeekdayRate: 60,
  breakfastWeekendRate: 50,
  lateNightEatingDays: 2,
  avgEatingWindowMinutes: 660,
  highlights: ['Breakfast skipped on 2 weekdays', 'Late-night eating on 2 days'],
};

function makeJob(overrides: Record<string, unknown> = {}): Job {
  return {
    id: 'job-1',
    name: 'meal-timing',
    data: {
      userId: 'u1',
      channels: ['telegram', 'push'],
      chatId: 'chat-1',
      locale: 'mn',
      pushTokens: ['token-1'],
      userName: 'Болд',
      insights: BASE_INSIGHTS,
      ...overrides,
    },
  } as unknown as Job;
}

let originalEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  jest.clearAllMocks();
  originalEnv = { ...process.env };
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
  mockSendExpoPush.mockResolvedValue(undefined);
  mockLogMessage.mockResolvedValue(undefined);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  process.env = originalEnv;
  jest.restoreAllMocks();
});

describe('processMealTimingJob', () => {
  it('skips when OPENAI_API_KEY is not set', async () => {
    delete process.env.OPENAI_API_KEY;

    await processMealTimingJob(makeJob());

    expect(getOpenAIMock()).not.toHaveBeenCalled();
  });

  it('generates insight via GPT-4o and delivers to both channels', async () => {
    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Өглөөний цайгаа алгасахгүй байхыг хичээгээрэй!' } }],
      usage: { prompt_tokens: 150, completion_tokens: 60 },
    });

    await processMealTimingJob(makeJob());

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-4o', temperature: 0.7, max_tokens: 300 }),
    );

    // Telegram with Markdown
    const TelegrafMock = Telegraf as unknown as jest.Mock;
    expect(TelegrafMock.mock.results[0].value.telegram.sendMessage).toHaveBeenCalledWith(
      'chat-1',
      expect.any(String),
      { parse_mode: 'Markdown' },
    );

    // Push delivery
    expect(mockSendExpoPush).toHaveBeenCalledWith(
      ['token-1'],
      'Хоол идэх цагийн дүн шинжилгээ 🕐',
      expect.any(String),
      { type: 'meal_timing_insights', screen: 'CoachChat' },
    );

    expect(mockLogMessage).toHaveBeenCalledTimes(2);
  });

  it('uses English title when locale is en', async () => {
    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Try not to skip breakfast!' } }],
      usage: {},
    });

    await processMealTimingJob(makeJob({ locale: 'en', channels: ['push'], pushTokens: ['t1'] }));

    expect(mockSendExpoPush).toHaveBeenCalledWith(
      ['t1'],
      'Meal timing insight 🕐',
      expect.any(String),
      expect.any(Object),
    );
  });

  it('throws when OpenAI fails', async () => {
    const mockCreate = getOpenAIMock();
    mockCreate.mockRejectedValue(new Error('Rate limited'));

    await expect(processMealTimingJob(makeJob())).rejects.toThrow('Rate limited');
  });

  it('skips delivery when no channels', async () => {
    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'test' } }],
      usage: {},
    });

    await processMealTimingJob(makeJob({ channels: [], chatId: undefined, pushTokens: [] }));

    expect(mockSendExpoPush).not.toHaveBeenCalled();
    expect(mockLogMessage).not.toHaveBeenCalled();
  });

  it('logs AI metadata in message log', async () => {
    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'insight text' } }],
      usage: { prompt_tokens: 100, completion_tokens: 40 },
    });

    await processMealTimingJob(makeJob({ channels: ['push'], pushTokens: ['t1'] }));

    expect(mockLogMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        aiModel: 'gpt-4o',
        promptTokens: 100,
        completionTokens: 40,
        messageType: 'meal_timing',
      }),
    );
  });

  it('uses fallback when GPT returns null content', async () => {
    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
      usage: {},
    });

    await processMealTimingJob(makeJob({ channels: ['push'], pushTokens: ['t1'] }));

    expect(mockSendExpoPush).toHaveBeenCalledWith(
      ['t1'],
      expect.any(String),
      expect.any(String),
      expect.any(Object),
    );
  });

  it('handles null avgEatingWindowMinutes in prompt', async () => {
    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Insight' } }],
      usage: {},
    });

    await processMealTimingJob(
      makeJob({
        insights: { ...BASE_INSIGHTS, avgEatingWindowMinutes: null },
        channels: ['push'],
        pushTokens: ['t1'],
      }),
    );

    const gptCall = mockCreate.mock.calls[0];
    const userMessage = gptCall[0].messages[1].content;
    expect(userMessage).toContain('unknown');
  });

  it('handles empty mealStats and highlights', async () => {
    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Everything looks great!' } }],
      usage: {},
    });

    await processMealTimingJob(
      makeJob({
        insights: { ...BASE_INSIGHTS, mealStats: [], highlights: [] },
        channels: ['push'],
        pushTokens: ['t1'],
      }),
    );

    const gptCall = mockCreate.mock.calls[0];
    const userMessage = gptCall[0].messages[1].content;
    expect(userMessage).toContain('no data');
  });

  it('defaults userName to "та" for Mongolian locale', async () => {
    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Insight' } }],
      usage: {},
    });

    await processMealTimingJob(makeJob({ userName: null, channels: ['push'], pushTokens: ['t1'] }));

    const gptCall = mockCreate.mock.calls[0];
    const userMessage = gptCall[0].messages[1].content;
    expect(userMessage).toContain('та');
  });

  it('logs Telegram delivery failure', async () => {
    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Insight' } }],
      usage: {},
    });

    (Telegraf as unknown as jest.Mock).mockImplementationOnce(() => ({
      telegram: { sendMessage: jest.fn().mockRejectedValue(new Error('TG error')) },
    }));

    await processMealTimingJob(makeJob({ channels: ['telegram'], chatId: 'c1', pushTokens: [] }));

    expect(mockLogMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'telegram', status: 'failed', errorMessage: 'TG error' }),
    );
  });
});
