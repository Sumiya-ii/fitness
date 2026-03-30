/**
 * Unit tests for the Coach Message processor.
 */

jest.mock('../expo-push', () => ({ sendExpoPush: jest.fn() }));
jest.mock('../message-log.service', () => ({ logMessage: jest.fn() }));
jest.mock('telegraf', () => ({
  Telegraf: jest.fn().mockImplementation(() => ({
    telegram: { sendMessage: jest.fn().mockResolvedValue(undefined) },
  })),
}));

const mockRedis = {
  get: jest.fn().mockResolvedValue(null),
  setex: jest.fn().mockResolvedValue('OK'),
  disconnect: jest.fn(),
};
jest.mock('ioredis', () => jest.fn().mockImplementation(() => mockRedis));

jest.mock('openai', () => {
  const mockCreate = jest.fn();
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }));
});

import { processCoachMessageJob } from './coach.processor';
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

const BASE_CONTEXT = {
  userName: 'Болд',
  locale: 'mn' as const,
  today: {
    mealsLogged: 2,
    caloriesConsumed: 1200,
    caloriesTarget: 2000,
    proteinConsumed: 60,
    proteinTarget: 120,
    carbsConsumed: 150,
    fatConsumed: 40,
    waterMl: 1500,
    waterTarget: 2500,
    mealTypes: ['breakfast', 'lunch'],
  },
  streak: { mealLoggingDays: 5, waterGoalDays: 3 },
  weekly: { avgDailyCalories: 1800, avgMealsPerDay: 2.5, daysWithWaterGoalMet: 4, totalDays: 7 },
  messageType: 'morning_greeting' as const,
  localTime: '08:30',
};

function makeJob(overrides: Record<string, unknown> = {}): Job {
  return {
    id: 'job-1',
    name: 'coach',
    data: {
      userId: 'u1',
      messageType: 'morning_greeting',
      channels: ['telegram', 'push'],
      chatId: 'chat-1',
      locale: 'mn',
      pushTokens: ['token-1'],
      context: BASE_CONTEXT,
      ...overrides,
    },
  } as unknown as Job;
}

let originalEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  jest.clearAllMocks();
  originalEnv = { ...process.env };
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.REDIS_URL = 'redis://localhost:6379';
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

describe('processCoachMessageJob', () => {
  it('skips when OPENAI_API_KEY is not set', async () => {
    delete process.env.OPENAI_API_KEY;

    await processCoachMessageJob(makeJob());

    expect(getOpenAIMock()).not.toHaveBeenCalled();
  });

  it('generates message via GPT-4o and delivers to both channels', async () => {
    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Өглөөний мэнд, Болд! 💪' } }],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    });

    await processCoachMessageJob(makeJob());

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-4o', temperature: 0.75, max_tokens: 300 }),
    );

    // Telegram delivery
    const TelegrafMock = Telegraf as unknown as jest.Mock;
    expect(TelegrafMock.mock.results[0].value.telegram.sendMessage).toHaveBeenCalledWith(
      'chat-1',
      'Өглөөний мэнд, Болд! 💪',
      { parse_mode: 'Markdown' },
    );

    // Push delivery
    expect(mockSendExpoPush).toHaveBeenCalledWith(
      ['token-1'],
      'Өглөөний мэнд! 🌅',
      'Өглөөний мэнд, Болд! 💪',
      { type: 'coach_message', screen: 'CoachChat' },
    );

    // Message logging
    expect(mockLogMessage).toHaveBeenCalledTimes(2);
  });

  it('injects message into Redis chat history', async () => {
    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Hello!' } }],
      usage: {},
    });

    await processCoachMessageJob(makeJob());

    expect(mockRedis.get).toHaveBeenCalledWith('chat:history:u1');
    expect(mockRedis.setex).toHaveBeenCalledWith(
      'chat:history:u1',
      604800,
      expect.stringContaining('Hello!'),
    );
    expect(mockRedis.disconnect).toHaveBeenCalled();
  });

  it('throws when OpenAI fails', async () => {
    const mockCreate = getOpenAIMock();
    mockCreate.mockRejectedValue(new Error('API overloaded'));

    await expect(processCoachMessageJob(makeJob())).rejects.toThrow('API overloaded');
    expect(mockRedis.disconnect).toHaveBeenCalled();
  });

  it('skips delivery when no channels available', async () => {
    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'test' } }],
      usage: {},
    });

    await processCoachMessageJob(makeJob({ channels: [], chatId: undefined, pushTokens: [] }));

    expect(mockSendExpoPush).not.toHaveBeenCalled();
    expect(mockLogMessage).not.toHaveBeenCalled();
  });

  it('uses fallback message when GPT returns null content', async () => {
    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
      usage: {},
    });

    await processCoachMessageJob(makeJob({ channels: ['push'], pushTokens: ['t1'] }));

    expect(mockSendExpoPush).toHaveBeenCalledWith(
      ['t1'],
      expect.any(String),
      expect.stringContaining('бүү мартаарай'),
      expect.any(Object),
    );
  });

  it('falls back to plain text when Markdown send fails', async () => {
    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Test *broken markdown' } }],
      usage: {},
    });

    const sendMessage = jest
      .fn()
      .mockRejectedValueOnce(new Error('Markdown parse error'))
      .mockResolvedValueOnce(undefined);

    (Telegraf as unknown as jest.Mock).mockImplementationOnce(() => ({
      telegram: { sendMessage },
    }));

    await processCoachMessageJob(makeJob({ channels: ['telegram'], chatId: 'c1', pushTokens: [] }));

    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage).toHaveBeenNthCalledWith(1, 'c1', 'Test *broken markdown', {
      parse_mode: 'Markdown',
    });
    expect(sendMessage).toHaveBeenNthCalledWith(2, 'c1', 'Test *broken markdown');
  });

  it('handles malformed JSON in Redis chat history gracefully', async () => {
    mockRedis.get.mockResolvedValue('not valid json{{{');

    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Hello!' } }],
      usage: {},
    });

    await processCoachMessageJob(makeJob());

    // Should still inject — invalid JSON resets to empty array
    expect(mockRedis.setex).toHaveBeenCalled();
    const savedHistory = JSON.parse(mockRedis.setex.mock.calls[0][2]);
    expect(savedHistory).toHaveLength(1);
    expect(savedHistory[0].content).toBe('Hello!');
  });

  it('appends to existing chat history', async () => {
    mockRedis.get.mockResolvedValue(
      JSON.stringify([{ role: 'user', content: 'Hi', timestamp: '2026-03-29T00:00:00Z' }]),
    );

    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Reply' } }],
      usage: {},
    });

    await processCoachMessageJob(makeJob());

    const savedHistory = JSON.parse(mockRedis.setex.mock.calls[0][2]);
    expect(savedHistory).toHaveLength(2);
    expect(savedHistory[1].role).toBe('assistant');
  });

  it('continues delivery even when Redis injection fails', async () => {
    mockRedis.get.mockRejectedValue(new Error('Redis down'));

    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'msg' } }],
      usage: {},
    });

    await processCoachMessageJob(makeJob({ channels: ['push'], pushTokens: ['t1'] }));

    // Should still deliver to push despite Redis failure
    expect(mockSendExpoPush).toHaveBeenCalled();
  });

  it('uses English fallback message when locale is en and GPT returns null', async () => {
    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
      usage: {},
    });

    await processCoachMessageJob(makeJob({ locale: 'en', channels: ['push'], pushTokens: ['t1'] }));

    expect(mockSendExpoPush).toHaveBeenCalledWith(
      ['t1'],
      expect.any(String),
      expect.stringContaining("Don't forget to log"),
      expect.any(Object),
    );
  });
});
