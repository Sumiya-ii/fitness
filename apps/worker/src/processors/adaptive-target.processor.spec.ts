/**
 * Unit tests for the Adaptive Target processor.
 */

jest.mock('../expo-push', () => ({ sendExpoPush: jest.fn() }));
jest.mock('../message-log.service', () => ({ logMessage: jest.fn() }));
jest.mock('telegraf', () => ({
  Telegraf: jest.fn().mockImplementation(() => ({
    telegram: { sendMessage: jest.fn().mockResolvedValue(undefined) },
  })),
}));

import { processAdaptiveTargetJob } from './adaptive-target.processor';
import { sendExpoPush } from '../expo-push';
import { logMessage } from '../message-log.service';
import { Telegraf } from 'telegraf';
import type { Job } from 'bullmq';

const mockSendExpoPush = sendExpoPush as jest.MockedFunction<typeof sendExpoPush>;
const mockLogMessage = logMessage as jest.MockedFunction<typeof logMessage>;

function makeJob(overrides: Record<string, unknown> = {}): Job {
  return {
    id: 'job-1',
    name: 'adaptive-target',
    data: {
      userId: 'u1',
      channels: ['telegram', 'push'],
      chatId: 'chat-1',
      locale: 'mn',
      pushTokens: ['token-1'],
      adjustmentKcal: 150,
      newCalorieTarget: 2150,
      goalType: 'lose_weight',
      reason: 'too_fast',
      ...overrides,
    },
  } as unknown as Job;
}

let originalEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  jest.clearAllMocks();
  originalEnv = { ...process.env };
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

describe('processAdaptiveTargetJob', () => {
  it('skips when no deliverable channels', async () => {
    await processAdaptiveTargetJob(makeJob({ channels: [], chatId: undefined, pushTokens: [] }));

    expect(mockSendExpoPush).not.toHaveBeenCalled();
    expect(mockLogMessage).not.toHaveBeenCalled();
  });

  it('sends Mongolian too_fast message via Telegram', async () => {
    await processAdaptiveTargetJob(makeJob({ channels: ['telegram'], pushTokens: [] }));

    const TelegrafMock = Telegraf as unknown as jest.Mock;
    const botInstance = TelegrafMock.mock.results[0].value;
    expect(botInstance.telegram.sendMessage).toHaveBeenCalledWith(
      'chat-1',
      expect.stringContaining('Сайн явж байна'),
    );
    expect(mockLogMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'telegram', status: 'sent' }),
    );
  });

  it('sends Mongolian too_slow message', async () => {
    await processAdaptiveTargetJob(
      makeJob({ reason: 'too_slow', adjustmentKcal: -100, channels: ['push'], pushTokens: ['t1'] }),
    );

    expect(mockSendExpoPush).toHaveBeenCalledWith(
      ['t1'],
      expect.stringContaining('🔄'),
      expect.stringContaining('удаашилсан'),
      expect.objectContaining({ type: 'adaptive_target' }),
    );
  });

  it('sends English too_fast message when locale is en', async () => {
    await processAdaptiveTargetJob(
      makeJob({ locale: 'en', channels: ['push'], pushTokens: ['t1'] }),
    );

    expect(mockSendExpoPush).toHaveBeenCalledWith(
      ['t1'],
      'Coach adjusted your target 📈',
      expect.stringContaining('protect muscle'),
      expect.any(Object),
    );
  });

  it('sends English too_slow message when locale is en', async () => {
    await processAdaptiveTargetJob(
      makeJob({
        locale: 'en',
        reason: 'too_slow',
        adjustmentKcal: -100,
        newCalorieTarget: 1900,
        channels: ['push'],
        pushTokens: ['t1'],
      }),
    );

    expect(mockSendExpoPush).toHaveBeenCalledWith(
      ['t1'],
      'Coach tweaked your target 🔄',
      expect.stringContaining('slower than expected'),
      expect.any(Object),
    );
  });

  it('delivers to both channels', async () => {
    await processAdaptiveTargetJob(makeJob());

    expect(mockSendExpoPush).toHaveBeenCalled();
    const TelegrafMock = Telegraf as unknown as jest.Mock;
    expect(TelegrafMock.mock.results[0].value.telegram.sendMessage).toHaveBeenCalled();
    expect(mockLogMessage).toHaveBeenCalledTimes(2);
  });

  it('includes metadata in log', async () => {
    await processAdaptiveTargetJob(makeJob({ channels: ['push'], pushTokens: ['t1'] }));

    expect(mockLogMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          reason: 'too_fast',
          adjustmentKcal: 150,
          newCalorieTarget: 2150,
        }),
      }),
    );
  });

  it('logs failure on push delivery error', async () => {
    mockSendExpoPush.mockRejectedValue(new Error('Push failed'));

    await processAdaptiveTargetJob(makeJob({ channels: ['push'], pushTokens: ['t1'] }));

    expect(mockLogMessage).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', errorMessage: 'Push failed' }),
    );
  });

  it('handles adjustmentKcal of zero', async () => {
    await processAdaptiveTargetJob(
      makeJob({ adjustmentKcal: 0, channels: ['push'], pushTokens: ['t1'], locale: 'en' }),
    );

    expect(mockSendExpoPush).toHaveBeenCalledWith(
      ['t1'],
      expect.any(String),
      expect.stringContaining('0 kcal'),
      expect.any(Object),
    );
  });

  it('defaults to Mongolian when locale is not provided', async () => {
    await processAdaptiveTargetJob(
      makeJob({ locale: undefined, channels: ['push'], pushTokens: ['t1'] }),
    );

    expect(mockSendExpoPush).toHaveBeenCalledWith(
      ['t1'],
      expect.stringContaining('Coach зорилтыг тохируулав'),
      expect.any(String),
      expect.any(Object),
    );
  });

  it('skips Telegram when bot token is not set', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;

    await processAdaptiveTargetJob(
      makeJob({ channels: ['telegram'], chatId: 'c1', pushTokens: [] }),
    );

    expect(mockLogMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'telegram', status: 'sent' }),
    );
  });

  it('logs Telegram failure on delivery error', async () => {
    (Telegraf as unknown as jest.Mock).mockImplementationOnce(() => ({
      telegram: { sendMessage: jest.fn().mockRejectedValue(new Error('Telegram 403')) },
    }));

    await processAdaptiveTargetJob(
      makeJob({ channels: ['telegram'], chatId: 'c1', pushTokens: [] }),
    );

    expect(mockLogMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'telegram',
        status: 'failed',
        errorMessage: 'Telegram 403',
      }),
    );
  });
});
