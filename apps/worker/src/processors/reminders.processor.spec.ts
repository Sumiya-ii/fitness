/**
 * Unit tests for the Reminders processor.
 */

jest.mock('../expo-push', () => ({ sendExpoPush: jest.fn() }));
jest.mock('../message-log.service', () => ({ logMessage: jest.fn() }));
jest.mock('telegraf', () => ({
  Telegraf: jest.fn().mockImplementation(() => ({
    telegram: { sendMessage: jest.fn().mockResolvedValue(undefined) },
  })),
}));

import { processReminderJob } from './reminders.processor';
import { sendExpoPush } from '../expo-push';
import { logMessage } from '../message-log.service';
import { Telegraf } from 'telegraf';
import type { Job } from 'bullmq';

const mockSendExpoPush = sendExpoPush as jest.MockedFunction<typeof sendExpoPush>;
const mockLogMessage = logMessage as jest.MockedFunction<typeof logMessage>;

function makeJob(data: Record<string, unknown>): Job {
  return { id: 'job-1', name: 'reminder', data } as unknown as Job;
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

describe('processReminderJob', () => {
  it('skips when no deliverable channels', async () => {
    await processReminderJob(
      makeJob({ userId: 'u1', type: 'morning', channels: [], locale: 'mn' }),
    );

    expect(mockSendExpoPush).not.toHaveBeenCalled();
    expect(mockLogMessage).not.toHaveBeenCalled();
  });

  it('sends morning reminder via Telegram', async () => {
    await processReminderJob(
      makeJob({
        userId: 'u1',
        type: 'morning',
        channels: ['telegram'],
        chatId: 'chat-123',
        locale: 'mn',
      }),
    );

    const TelegrafMock = Telegraf as unknown as jest.Mock;
    const botInstance = TelegrafMock.mock.results[0].value;
    expect(botInstance.telegram.sendMessage).toHaveBeenCalledWith('chat-123', expect.any(String));
    expect(mockLogMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'telegram', status: 'sent', userId: 'u1' }),
    );
  });

  it('sends evening reminder via push', async () => {
    await processReminderJob(
      makeJob({
        userId: 'u1',
        type: 'evening',
        channels: ['push'],
        pushTokens: ['token-1'],
        locale: 'mn',
      }),
    );

    expect(mockSendExpoPush).toHaveBeenCalledWith(
      ['token-1'],
      expect.any(String),
      expect.any(String),
      { type: 'reminder' },
    );
    expect(mockLogMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'push', status: 'sent' }),
    );
  });

  it('uses English messages when locale is en', async () => {
    await processReminderJob(
      makeJob({
        userId: 'u1',
        type: 'morning',
        channels: ['push'],
        pushTokens: ['t1'],
        locale: 'en',
      }),
    );

    const [tokens, title, body, extra] = (mockSendExpoPush as jest.Mock).mock.calls[0];
    expect(tokens).toEqual(['t1']);
    expect(extra).toEqual({ type: 'reminder' });
    // Title and body must be one of the English morning variants
    const validTitles = ['Good morning! 🌅', 'Rise and shine! ☀️', 'Morning! 💪'];
    const validBodies = [
      "New day, fresh start. What's the breakfast plan?",
      "What's on the menu today? Coach is ready when you are.",
      "You logged well yesterday. Let's keep the momentum going!",
    ];
    expect(validTitles).toContain(title);
    expect(validBodies).toContain(body);
  });

  it('sends to both channels simultaneously', async () => {
    await processReminderJob(
      makeJob({
        userId: 'u1',
        type: 'morning',
        channels: ['telegram', 'push'],
        chatId: 'chat-1',
        pushTokens: ['token-1'],
        locale: 'mn',
      }),
    );

    expect(mockSendExpoPush).toHaveBeenCalled();
    const TelegrafMock = Telegraf as unknown as jest.Mock;
    expect(TelegrafMock.mock.results[0].value.telegram.sendMessage).toHaveBeenCalled();
    expect(mockLogMessage).toHaveBeenCalledTimes(2);
  });

  it('logs failure when Telegram delivery fails', async () => {
    (Telegraf as unknown as jest.Mock).mockImplementationOnce(() => ({
      telegram: { sendMessage: jest.fn().mockRejectedValue(new Error('Telegram down')) },
    }));

    await processReminderJob(
      makeJob({
        userId: 'u1',
        type: 'morning',
        channels: ['telegram'],
        chatId: 'chat-1',
        locale: 'mn',
      }),
    );

    expect(mockLogMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'telegram',
        status: 'failed',
        errorMessage: 'Telegram down',
      }),
    );
  });

  it('logs failure when push delivery fails', async () => {
    mockSendExpoPush.mockRejectedValue(new Error('Push API error'));

    await processReminderJob(
      makeJob({
        userId: 'u1',
        type: 'morning',
        channels: ['push'],
        pushTokens: ['t1'],
        locale: 'mn',
      }),
    );

    expect(mockLogMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'push',
        status: 'failed',
        errorMessage: 'Push API error',
      }),
    );
  });

  it('skips telegram when chatId is missing even if channel listed', async () => {
    await processReminderJob(
      makeJob({ userId: 'u1', type: 'morning', channels: ['telegram'], locale: 'mn' }),
    );

    expect(mockLogMessage).not.toHaveBeenCalled();
  });

  it('defaults to Mongolian when locale is not provided', async () => {
    await processReminderJob(
      makeJob({
        userId: 'u1',
        type: 'morning',
        channels: ['push'],
        pushTokens: ['t1'],
      }),
    );

    const [tokens, title, body, extra] = (mockSendExpoPush as jest.Mock).mock.calls[0];
    expect(tokens).toEqual(['t1']);
    expect(extra).toEqual({ type: 'reminder' });
    // Title and body must be one of the Mongolian morning variants
    const validTitles = ['Өглөөний мэнд! 🌅', 'Өглөө болж байна! ☀️', 'Сайн уу! 💪'];
    const validBodies = [
      'Шинэ өдөр, шинэ боломж. Өглөөний цайгаа юу болгох вэ?',
      'Өнөөдөр юу идэхээ төлөвлөж байна уу? Coach бэлэн.',
      'Өчигдөр сайн хоол бүртгэсэн. Өнөөдөр ч тэгцгээе!',
    ];
    expect(validTitles).toContain(title);
    expect(validBodies).toContain(body);
  });

  it('falls back to Mongolian for unknown locale', async () => {
    await processReminderJob(
      makeJob({
        userId: 'u1',
        type: 'morning',
        channels: ['push'],
        pushTokens: ['t1'],
        locale: 'jp',
      }),
    );

    const [tokens, title, body, extra] = (mockSendExpoPush as jest.Mock).mock.calls[0];
    expect(tokens).toEqual(['t1']);
    expect(extra).toEqual({ type: 'reminder' });
    // Unknown locale falls back to Mongolian variants
    const validTitles = ['Өглөөний мэнд! 🌅', 'Өглөө болж байна! ☀️', 'Сайн уу! 💪'];
    const validBodies = [
      'Шинэ өдөр, шинэ боломж. Өглөөний цайгаа юу болгох вэ?',
      'Өнөөдөр юу идэхээ төлөвлөж байна уу? Coach бэлэн.',
      'Өчигдөр сайн хоол бүртгэсэн. Өнөөдөр ч тэгцгээе!',
    ];
    expect(validTitles).toContain(title);
    expect(validBodies).toContain(body);
  });

  it('skips push when pushTokens is empty array', async () => {
    await processReminderJob(
      makeJob({
        userId: 'u1',
        type: 'morning',
        channels: ['push'],
        pushTokens: [],
        locale: 'mn',
      }),
    );

    expect(mockSendExpoPush).not.toHaveBeenCalled();
  });

  it('skips Telegram when bot token is not set', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;

    await processReminderJob(
      makeJob({
        userId: 'u1',
        type: 'morning',
        channels: ['telegram'],
        chatId: 'chat-1',
        locale: 'mn',
      }),
    );

    // sendTelegramReminder returns early without instantiating Telegraf or sending
    const TelegrafMock = Telegraf as unknown as jest.Mock;
    expect(TelegrafMock).not.toHaveBeenCalled();
    // The delivery IIFE catches no error, so logMessage is still called with 'sent'
    expect(mockLogMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'telegram', status: 'sent' }),
    );
  });
});
