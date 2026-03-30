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

import {
  processCoachMessageJob,
  isMessageTypeValidForTime,
  getTimePeriod,
  buildUserPrompt,
} from './coach.processor';
import { sendExpoPush } from '../expo-push';
import { logMessage } from '../message-log.service';
import { Telegraf } from 'telegraf';
import { DateTime } from 'luxon';
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
      timezone: 'Asia/Ulaanbaatar',
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
  // Default: mock DateTime.now() to 08:00 (within morning_greeting window)
  const mockNow = DateTime.fromObject({ hour: 8, minute: 0 }, { zone: 'Asia/Ulaanbaatar' });
  jest.spyOn(DateTime, 'now').mockReturnValue(mockNow as DateTime<true>);
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

// ── Time-of-day validation (regression tests for stale job bug) ──────────────

describe('isMessageTypeValidForTime', () => {
  it('accepts morning_greeting at 08:00', () => {
    expect(isMessageTypeValidForTime('morning_greeting', '08:00')).toBe(true);
  });

  it('rejects morning_greeting at 14:00 (afternoon)', () => {
    expect(isMessageTypeValidForTime('morning_greeting', '14:00')).toBe(false);
  });

  it('rejects morning_greeting at 10:00 (past window)', () => {
    expect(isMessageTypeValidForTime('morning_greeting', '10:00')).toBe(false);
  });

  it('accepts water_reminder at 10:30', () => {
    expect(isMessageTypeValidForTime('water_reminder', '10:30')).toBe(true);
  });

  it('accepts water_reminder at 16:00 (afternoon window)', () => {
    expect(isMessageTypeValidForTime('water_reminder', '16:00')).toBe(true);
  });

  it('rejects water_reminder at 09:00', () => {
    expect(isMessageTypeValidForTime('water_reminder', '09:00')).toBe(false);
  });

  it('accepts progress_feedback at 20:30', () => {
    expect(isMessageTypeValidForTime('progress_feedback', '20:30')).toBe(true);
  });

  it('rejects progress_feedback at 08:00 (morning)', () => {
    expect(isMessageTypeValidForTime('progress_feedback', '08:00')).toBe(false);
  });

  it('accepts midday_checkin at 12:30', () => {
    expect(isMessageTypeValidForTime('midday_checkin', '12:30')).toBe(true);
  });

  it('rejects midday_checkin at 15:00', () => {
    expect(isMessageTypeValidForTime('midday_checkin', '15:00')).toBe(false);
  });

  it('accepts meal_nudge at 11:30 (morning window)', () => {
    expect(isMessageTypeValidForTime('meal_nudge', '11:30')).toBe(true);
  });

  it('accepts meal_nudge at 19:00 (evening window)', () => {
    expect(isMessageTypeValidForTime('meal_nudge', '19:00')).toBe(true);
  });

  it('rejects meal_nudge at 14:00 (between windows)', () => {
    expect(isMessageTypeValidForTime('meal_nudge', '14:00')).toBe(false);
  });
});

describe('getTimePeriod', () => {
  it.each([
    ['06:00', 'morning'],
    ['08:30', 'morning'],
    ['11:59', 'morning'],
    ['12:00', 'afternoon'],
    ['14:00', 'afternoon'],
    ['16:59', 'afternoon'],
    ['17:00', 'evening'],
    ['20:30', 'evening'],
    ['21:00', 'night'],
    ['23:00', 'night'],
    ['03:00', 'night'],
  ])('returns %s for %s', (time, expected) => {
    expect(getTimePeriod(time)).toBe(expected);
  });
});

describe('buildUserPrompt — time-of-day awareness', () => {
  it('includes "morning" period for morning_greeting with no time constraint warning', () => {
    const prompt = buildUserPrompt(
      {
        userId: 'u1',
        messageType: 'morning_greeting',
        channels: [],
        context: { ...BASE_CONTEXT, localTime: '08:00', messageType: 'morning_greeting' },
      },
      '08:00',
    );
    expect(prompt).toContain('Current time: 08:00 (morning)');
    expect(prompt).not.toContain('CRITICAL');
    expect(prompt).not.toContain('Do NOT use morning greetings');
  });

  it('includes CRITICAL time constraint for non-morning types', () => {
    const prompt = buildUserPrompt(
      {
        userId: 'u1',
        messageType: 'progress_feedback',
        channels: [],
        context: { ...BASE_CONTEXT, localTime: '20:30', messageType: 'progress_feedback' },
      },
      '20:30',
    );
    expect(prompt).toContain('Current time: 20:30 (evening)');
    expect(prompt).toContain('CRITICAL');
    expect(prompt).toContain('Do NOT use morning greetings');
    expect(prompt).toContain('Match your tone to the evening');
  });

  it('uses fresh currentLocalTime over stale context.localTime', () => {
    const prompt = buildUserPrompt(
      {
        userId: 'u1',
        messageType: 'water_reminder',
        channels: [],
        context: { ...BASE_CONTEXT, localTime: '10:00', messageType: 'water_reminder' },
      },
      '15:30', // fresh time from processor
    );
    expect(prompt).toContain('Current time: 15:30 (afternoon)');
    expect(prompt).not.toContain('10:00');
  });

  it('falls back to context.localTime when currentLocalTime is not provided', () => {
    const prompt = buildUserPrompt({
      userId: 'u1',
      messageType: 'morning_greeting',
      channels: [],
      context: { ...BASE_CONTEXT, localTime: '08:15', messageType: 'morning_greeting' },
    });
    expect(prompt).toContain('Current time: 08:15 (morning)');
  });

  it('includes afternoon constraint for midday_checkin', () => {
    const prompt = buildUserPrompt(
      {
        userId: 'u1',
        messageType: 'midday_checkin',
        channels: [],
        context: { ...BASE_CONTEXT, localTime: '12:30', messageType: 'midday_checkin' },
      },
      '12:30',
    );
    expect(prompt).toContain('Current time: 12:30 (afternoon)');
    expect(prompt).toContain('Do NOT use morning greetings');
  });
});

describe('processCoachMessageJob — staleness guard', () => {
  it('skips stale morning_greeting job when user local time is afternoon', async () => {
    // Mock DateTime.now().setZone() to return 14:00
    const mockNow = DateTime.fromObject({ hour: 14, minute: 0 }, { zone: 'Asia/Ulaanbaatar' });
    jest.spyOn(DateTime, 'now').mockReturnValue(mockNow as DateTime<true>);

    const job = makeJob({
      messageType: 'morning_greeting',
      timezone: 'Asia/Ulaanbaatar',
      context: { ...BASE_CONTEXT, localTime: '08:00', messageType: 'morning_greeting' },
    });

    await processCoachMessageJob(job);

    // Should NOT call OpenAI — job is stale
    expect(getOpenAIMock()).not.toHaveBeenCalled();
    expect(mockSendExpoPush).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Stale job: morning_greeting'),
    );
  });

  it('skips stale progress_feedback job when user local time is morning', async () => {
    const mockNow = DateTime.fromObject({ hour: 8, minute: 30 }, { zone: 'Asia/Ulaanbaatar' });
    jest.spyOn(DateTime, 'now').mockReturnValue(mockNow as DateTime<true>);

    const job = makeJob({
      messageType: 'progress_feedback',
      timezone: 'Asia/Ulaanbaatar',
      context: { ...BASE_CONTEXT, localTime: '20:30', messageType: 'progress_feedback' },
    });

    await processCoachMessageJob(job);

    expect(getOpenAIMock()).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Stale job: progress_feedback'),
    );
  });

  it('processes valid morning_greeting job when user local time is 08:00', async () => {
    const mockNow = DateTime.fromObject({ hour: 8, minute: 0 }, { zone: 'Asia/Ulaanbaatar' });
    jest.spyOn(DateTime, 'now').mockReturnValue(mockNow as DateTime<true>);

    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Өглөөний мэнд!' } }],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    });

    const job = makeJob({
      messageType: 'morning_greeting',
      timezone: 'Asia/Ulaanbaatar',
      context: { ...BASE_CONTEXT, localTime: '08:00', messageType: 'morning_greeting' },
    });

    await processCoachMessageJob(job);

    // Should proceed with generation
    expect(mockCreate).toHaveBeenCalled();
  });

  it('proceeds without staleness check when timezone is not provided (backwards compat)', async () => {
    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Hello!' } }],
      usage: {},
    });

    const job = makeJob({ timezone: undefined });

    await processCoachMessageJob(job);

    // Should still generate — no timezone means no staleness check
    expect(mockCreate).toHaveBeenCalled();
  });

  it('uses recalculated localTime in prompt when timezone is available', async () => {
    const mockNow = DateTime.fromObject({ hour: 8, minute: 15 }, { zone: 'Asia/Ulaanbaatar' });
    jest.spyOn(DateTime, 'now').mockReturnValue(mockNow as DateTime<true>);

    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Test' } }],
      usage: {},
    });

    const job = makeJob({
      messageType: 'morning_greeting',
      timezone: 'Asia/Ulaanbaatar',
      context: { ...BASE_CONTEXT, localTime: '07:45', messageType: 'morning_greeting' },
    });

    await processCoachMessageJob(job);

    // The prompt should use 08:15 (recalculated), not 07:45 (enqueue time)
    const callArgs = mockCreate.mock.calls[0][0];
    const userPrompt = callArgs.messages[1].content;
    expect(userPrompt).toContain('08:15');
    expect(userPrompt).not.toContain('07:45');
  });
});
