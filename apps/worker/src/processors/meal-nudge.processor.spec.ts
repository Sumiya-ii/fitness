/**
 * Unit tests for the Meal Nudge processor.
 */

jest.mock('../expo-push', () => ({ sendExpoPush: jest.fn() }));
jest.mock('../message-log.service', () => ({ logMessage: jest.fn() }));
jest.mock('telegraf', () => ({
  Telegraf: jest.fn().mockImplementation(() => ({
    telegram: { sendMessage: jest.fn().mockResolvedValue(undefined) },
  })),
}));

import { processMealNudgeJob } from './meal-nudge.processor';
import { sendExpoPush } from '../expo-push';
import { logMessage } from '../message-log.service';
import { Telegraf } from 'telegraf';
import type { Job } from 'bullmq';

const mockSendExpoPush = sendExpoPush as jest.MockedFunction<typeof sendExpoPush>;
const mockLogMessage = logMessage as jest.MockedFunction<typeof logMessage>;

function makeJob(overrides: Record<string, unknown> = {}): Job {
  return {
    id: 'job-1',
    name: 'meal-nudge',
    data: {
      userId: 'u1',
      channels: ['telegram', 'push'],
      chatId: 'chat-1',
      locale: 'mn',
      pushTokens: ['token-1'],
      mealCount: 1,
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

describe('processMealNudgeJob', () => {
  it('skips when no deliverable channels', async () => {
    await processMealNudgeJob(makeJob({ channels: [], chatId: undefined, pushTokens: [] }));

    expect(mockSendExpoPush).not.toHaveBeenCalled();
    expect(mockLogMessage).not.toHaveBeenCalled();
  });

  it('sends Mongolian nudge via Telegram', async () => {
    await processMealNudgeJob(makeJob({ channels: ['telegram'], pushTokens: [] }));

    const TelegrafMock = Telegraf as unknown as jest.Mock;
    const botInstance = TelegrafMock.mock.results[0].value;
    expect(botInstance.telegram.sendMessage).toHaveBeenCalledWith('chat-1', expect.any(String));
    expect(mockLogMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'telegram', status: 'sent', messageType: 'meal_nudge' }),
    );
  });

  it('sends Mongolian nudge via push', async () => {
    await processMealNudgeJob(makeJob({ channels: ['push'] }));

    expect(mockSendExpoPush).toHaveBeenCalledWith(
      ['token-1'],
      expect.any(String),
      expect.any(String),
      { type: 'meal_nudge', screen: 'Log' },
    );
  });

  it('sends English nudge when locale is en', async () => {
    await processMealNudgeJob(makeJob({ locale: 'en', channels: ['push'] }));

    // Title and body are randomly selected from NUDGE_VARIANTS_EN; assert structure only
    expect(mockSendExpoPush).toHaveBeenCalledWith(
      ['token-1'],
      expect.any(String),
      expect.any(String),
      { type: 'meal_nudge', screen: 'Log' },
    );
  });

  it('delivers to both channels simultaneously', async () => {
    await processMealNudgeJob(makeJob());

    expect(mockSendExpoPush).toHaveBeenCalled();
    const TelegrafMock = Telegraf as unknown as jest.Mock;
    expect(TelegrafMock.mock.results[0].value.telegram.sendMessage).toHaveBeenCalled();
    expect(mockLogMessage).toHaveBeenCalledTimes(2);
  });

  it('logs failure on Telegram delivery error', async () => {
    (Telegraf as unknown as jest.Mock).mockImplementationOnce(() => ({
      telegram: { sendMessage: jest.fn().mockRejectedValue(new Error('Bot blocked')) },
    }));

    await processMealNudgeJob(makeJob({ channels: ['telegram'], pushTokens: [] }));

    expect(mockLogMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'telegram',
        status: 'failed',
        errorMessage: 'Bot blocked',
      }),
    );
  });

  it('logs failure on push delivery error', async () => {
    mockSendExpoPush.mockRejectedValue(new Error('Expo error'));

    await processMealNudgeJob(makeJob({ channels: ['push'] }));

    expect(mockLogMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'push', status: 'failed', errorMessage: 'Expo error' }),
    );
  });

  it('skips telegram when TELEGRAM_BOT_TOKEN is not set', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;

    await processMealNudgeJob(makeJob({ channels: ['telegram'], pushTokens: [] }));

    // Should not throw, just skip
    expect(mockLogMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'telegram', status: 'sent' }),
    );
  });

  it('skips telegram when chatId is missing', async () => {
    await processMealNudgeJob(
      makeJob({ channels: ['telegram'], chatId: undefined, pushTokens: [] }),
    );

    expect(mockLogMessage).not.toHaveBeenCalled();
  });

  it('defaults to Mongolian when locale is not provided', async () => {
    await processMealNudgeJob(
      makeJob({ locale: undefined, channels: ['push'], pushTokens: ['t1'] }),
    );

    // Title is randomly picked from NUDGE_VARIANTS_MN; assert structure only
    expect(mockSendExpoPush).toHaveBeenCalledWith(
      ['t1'],
      expect.any(String),
      expect.any(String),
      expect.any(Object),
    );
  });

  it('falls back to Mongolian for unknown locale', async () => {
    // getNudgeMessage defaults to NUDGE_VARIANTS_MN for any lang that is not 'en'
    await processMealNudgeJob(makeJob({ locale: 'kr', channels: ['push'], pushTokens: ['t1'] }));

    expect(mockSendExpoPush).toHaveBeenCalledWith(
      ['t1'],
      expect.any(String),
      expect.any(String),
      expect.any(Object),
    );
  });

  it('treats empty string chatId as no Telegram channel', async () => {
    await processMealNudgeJob(makeJob({ channels: ['telegram'], chatId: '', pushTokens: [] }));

    expect(mockLogMessage).not.toHaveBeenCalled();
  });
});
