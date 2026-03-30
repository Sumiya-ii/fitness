/**
 * Unit tests for the Weekly Report processor.
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

import { processWeeklyReportJob } from './weekly-report.processor';
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

const BASE_REPORT = {
  weekStart: '2026-03-22',
  weekEnd: '2026-03-28',
  daysLogged: 5,
  averageCalories: 1850,
  averageProtein: 95,
  calorieTarget: 2000,
  proteinTarget: 120,
  adherenceScore: 72,
  weightDelta: -0.5,
  endOfWeekStreak: 4,
};

function makeJob(overrides: Record<string, unknown> = {}): Job {
  return {
    id: 'job-1',
    name: 'weekly-report',
    data: {
      userId: 'u1',
      channels: ['telegram', 'push'],
      chatId: 'chat-1',
      locale: 'mn',
      pushTokens: ['token-1'],
      report: BASE_REPORT,
      userName: 'Болд',
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

describe('processWeeklyReportJob', () => {
  it('skips when OPENAI_API_KEY is not set', async () => {
    delete process.env.OPENAI_API_KEY;

    await processWeeklyReportJob(makeJob());

    expect(getOpenAIMock()).not.toHaveBeenCalled();
  });

  it('generates report via GPT-4o and delivers to both channels', async () => {
    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Болд, энэ долоо хоногт сайн ажилласан!' } }],
      usage: { prompt_tokens: 200, completion_tokens: 80 },
    });

    await processWeeklyReportJob(makeJob());

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-4o', temperature: 0.75, max_tokens: 400 }),
    );

    // Telegram delivery with Markdown
    const TelegrafMock = Telegraf as unknown as jest.Mock;
    expect(TelegrafMock.mock.results[0].value.telegram.sendMessage).toHaveBeenCalledWith(
      'chat-1',
      'Болд, энэ долоо хоногт сайн ажилласан!',
      { parse_mode: 'Markdown' },
    );

    // Push delivery
    expect(mockSendExpoPush).toHaveBeenCalledWith(
      ['token-1'],
      '7 хоногийн тайлан 📊',
      'Болд, энэ долоо хоногт сайн ажилласан!',
      { type: 'weekly_report', screen: 'CoachChat' },
    );

    expect(mockLogMessage).toHaveBeenCalledTimes(2);
  });

  it('injects report into Redis chat history', async () => {
    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Weekly report content' } }],
      usage: {},
    });

    await processWeeklyReportJob(makeJob());

    expect(mockRedis.setex).toHaveBeenCalledWith(
      'chat:history:u1',
      604800,
      expect.stringContaining('Weekly report content'),
    );
    expect(mockRedis.disconnect).toHaveBeenCalled();
  });

  it('throws when OpenAI fails', async () => {
    const mockCreate = getOpenAIMock();
    mockCreate.mockRejectedValue(new Error('GPT error'));

    await expect(processWeeklyReportJob(makeJob())).rejects.toThrow('GPT error');
    expect(mockRedis.disconnect).toHaveBeenCalled();
  });

  it('uses English push title when locale is en', async () => {
    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Great week!' } }],
      usage: {},
    });

    await processWeeklyReportJob(makeJob({ locale: 'en', channels: ['push'], pushTokens: ['t1'] }));

    expect(mockSendExpoPush).toHaveBeenCalledWith(
      ['t1'],
      'Your weekly report 📊',
      'Great week!',
      expect.any(Object),
    );
  });

  it('skips delivery when no channels', async () => {
    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'test' } }],
      usage: {},
    });

    await processWeeklyReportJob(makeJob({ channels: [], chatId: undefined, pushTokens: [] }));

    expect(mockSendExpoPush).not.toHaveBeenCalled();
    expect(mockLogMessage).not.toHaveBeenCalled();
  });

  it('uses fallback message when GPT returns null content', async () => {
    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
      usage: {},
    });

    await processWeeklyReportJob(makeJob({ channels: ['push'], pushTokens: ['t1'] }));

    expect(mockSendExpoPush).toHaveBeenCalledWith(
      ['t1'],
      expect.any(String),
      expect.stringContaining('💪'),
      expect.any(Object),
    );
  });

  it('handles malformed JSON in Redis chat history', async () => {
    mockRedis.get.mockResolvedValue('{{invalid');

    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Report text' } }],
      usage: {},
    });

    await processWeeklyReportJob(makeJob());

    const savedHistory = JSON.parse(mockRedis.setex.mock.calls[0][2]);
    expect(savedHistory).toHaveLength(1);
  });

  it('continues delivery when Redis injection fails', async () => {
    mockRedis.get.mockRejectedValue(new Error('Redis down'));

    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Report' } }],
      usage: {},
    });

    await processWeeklyReportJob(makeJob({ channels: ['push'], pushTokens: ['t1'] }));

    expect(mockSendExpoPush).toHaveBeenCalled();
    expect(mockRedis.disconnect).toHaveBeenCalled();
  });

  it('uses "та" as name when userName is null and locale is mn', async () => {
    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Report text' } }],
      usage: {},
    });

    await processWeeklyReportJob(makeJob({ userName: null }));

    const gptCall = mockCreate.mock.calls[0];
    const userMessage = gptCall[0].messages[1].content;
    expect(userMessage).toContain('та');
  });

  it('handles report with null weightDelta and null targets', async () => {
    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Report' } }],
      usage: {},
    });

    await processWeeklyReportJob(
      makeJob({
        report: { ...BASE_REPORT, weightDelta: null, calorieTarget: null, proteinTarget: null },
        channels: ['push'],
        pushTokens: ['t1'],
      }),
    );

    const gptCall = mockCreate.mock.calls[0];
    const userMessage = gptCall[0].messages[1].content;
    expect(userMessage).toContain('no weight data');
  });
});
