/**
 * Unit tests for the Reminders processor.
 */

const mockPoolQuery = jest.fn();
const mockPoolEnd = jest.fn();
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: mockPoolQuery,
    end: mockPoolEnd,
  })),
}));

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

/** Mock the timezone DB query to return the given timezone string. */
function mockTimezone(tz: string) {
  mockPoolQuery.mockResolvedValueOnce({ rows: [{ timezone: tz }] });
}

/** Mock the timezone DB query to return no rows (simulates missing profile). */
function mockNoTimezone() {
  mockPoolQuery.mockResolvedValueOnce({ rows: [] });
}

let originalEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  jest.clearAllMocks();
  originalEnv = { ...process.env };
  process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
  process.env.DATABASE_URL = 'postgres://localhost/test';
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

// ── 1. Missing env vars ───────────────────────────────────────────────────────

describe('missing env vars', () => {
  it('skips timezone check and sends when DATABASE_URL is not set', async () => {
    delete process.env.DATABASE_URL;

    await processReminderJob(
      makeJob({
        userId: 'u1',
        type: 'morning',
        channels: ['push'],
        pushTokens: ['t1'],
        locale: 'mn',
      }),
    );

    // No DB query, still delivers (no timezone gate without DB_URL)
    expect(mockPoolQuery).not.toHaveBeenCalled();
    expect(mockSendExpoPush).toHaveBeenCalled();
  });
});

// ── 2. No deliverable channels ────────────────────────────────────────────────

describe('no deliverable channels', () => {
  it('skips when channels array is empty', async () => {
    mockTimezone('Asia/Ulaanbaatar');

    await processReminderJob(
      makeJob({ userId: 'u1', type: 'morning', channels: [], locale: 'mn' }),
    );

    expect(mockSendExpoPush).not.toHaveBeenCalled();
    expect(mockLogMessage).not.toHaveBeenCalled();
  });

  it('skips telegram when chatId is missing even if channel listed', async () => {
    mockTimezone('Asia/Ulaanbaatar');

    await processReminderJob(
      makeJob({ userId: 'u1', type: 'morning', channels: ['telegram'], locale: 'mn' }),
    );

    expect(mockLogMessage).not.toHaveBeenCalled();
  });

  it('skips push when pushTokens is empty array', async () => {
    mockTimezone('Asia/Ulaanbaatar');

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
});

// ── 3. Happy path delivery ────────────────────────────────────────────────────

describe('delivery', () => {
  it('sends morning reminder via Telegram', async () => {
    mockTimezone('Asia/Ulaanbaatar');

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
    mockTimezone('Asia/Ulaanbaatar');

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

  it('sends to both channels simultaneously', async () => {
    mockTimezone('Asia/Ulaanbaatar');

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
});

// ── 4. Both delivery channels independently ───────────────────────────────────

describe('delivery channel failures', () => {
  it('logs failure when Telegram delivery fails', async () => {
    mockTimezone('Asia/Ulaanbaatar');
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
    mockTimezone('Asia/Ulaanbaatar');
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

  it('skips Telegram when bot token is not set', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    mockTimezone('Asia/Ulaanbaatar');

    await processReminderJob(
      makeJob({
        userId: 'u1',
        type: 'morning',
        channels: ['telegram'],
        chatId: 'chat-1',
        locale: 'mn',
      }),
    );

    const TelegrafMock = Telegraf as unknown as jest.Mock;
    expect(TelegrafMock).not.toHaveBeenCalled();
    expect(mockLogMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'telegram', status: 'sent' }),
    );
  });
});

// ── 5. Locale handling ────────────────────────────────────────────────────────

describe('locale handling', () => {
  it('uses English messages when locale is en', async () => {
    mockTimezone('Asia/Ulaanbaatar');

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
    const validTitles = ['Good morning! 🌅', 'Rise and shine! ☀️', 'Morning! 💪'];
    const validBodies = [
      "New day, fresh start. What's the breakfast plan?",
      "What's on the menu today? Coach is ready when you are.",
      "You logged well yesterday. Let's keep the momentum going!",
    ];
    expect(validTitles).toContain(title);
    expect(validBodies).toContain(body);
  });

  it('defaults to Mongolian when locale is not provided', async () => {
    mockTimezone('Asia/Ulaanbaatar');

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
    mockTimezone('Asia/Ulaanbaatar');

    await processReminderJob(
      makeJob({
        userId: 'u1',
        type: 'morning',
        channels: ['push'],
        pushTokens: ['t1'],
        locale: 'jp',
      }),
    );

    const [, title] = (mockSendExpoPush as jest.Mock).mock.calls[0];
    const validTitles = ['Өглөөний мэнд! 🌅', 'Өглөө болж байна! ☀️', 'Сайн уу! 💪'];
    expect(validTitles).toContain(title);
  });
});

// ── 6. Timezone delivery window ───────────────────────────────────────────────

describe('timezone delivery window', () => {
  /**
   * We mock the system clock (Date) to control what "now" is, then let
   * the real Intl.DateTimeFormat convert it to the target timezone.
   * Asia/Ulaanbaatar = UTC+8. So UTC 03:00 = 11:00 UB local (in window).
   * America/New_York (EDT) = UTC-4. So UTC 02:00 = 22:00 NY local (boundary, excluded).
   * UTC 03:00 = 22:00 NY: excluded (>= 22). UTC 01:00 = 21:00 NY: included.
   */

  it('sends when user timezone Asia/Ulaanbaatar and local hour is 11 (UTC 03:00)', async () => {
    // UTC 03:00 → UB 11:00 (UTC+8)
    jest.useFakeTimers().setSystemTime(new Date('2024-01-15T03:00:00Z'));
    mockTimezone('Asia/Ulaanbaatar');

    await processReminderJob(
      makeJob({
        userId: 'u1',
        type: 'morning',
        channels: ['push'],
        pushTokens: ['t1'],
        locale: 'mn',
      }),
    );

    expect(mockSendExpoPush).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('sends when user timezone America/New_York and local hour is 21 (UTC 01:00 in summer)', async () => {
    // UTC 01:00 → New York EDT (UTC-4) = 21:00 — within window
    jest.useFakeTimers().setSystemTime(new Date('2024-07-15T01:00:00Z'));
    mockTimezone('America/New_York');

    await processReminderJob(
      makeJob({
        userId: 'u1',
        type: 'evening',
        channels: ['push'],
        pushTokens: ['t1'],
        locale: 'en',
      }),
    );

    expect(mockSendExpoPush).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('skips when local hour is 3 AM (outside window)', async () => {
    // UTC 19:00 → UB 03:00 next day (UTC+8) — outside window
    jest.useFakeTimers().setSystemTime(new Date('2024-01-15T19:00:00Z'));
    mockTimezone('Asia/Ulaanbaatar');

    await processReminderJob(
      makeJob({
        userId: 'u1',
        type: 'morning',
        channels: ['push'],
        pushTokens: ['t1'],
        locale: 'mn',
      }),
    );

    expect(mockSendExpoPush).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('defaults to Asia/Ulaanbaatar when profile has no timezone row', async () => {
    // UTC 19:00 → UB 03:00 — outside window, so with UB default it should skip
    jest.useFakeTimers().setSystemTime(new Date('2024-01-15T19:00:00Z'));
    mockNoTimezone(); // no profile row

    await processReminderJob(
      makeJob({
        userId: 'u1',
        type: 'morning',
        channels: ['push'],
        pushTokens: ['t1'],
        locale: 'mn',
      }),
    );

    expect(mockSendExpoPush).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('closes the DB pool after timezone check even when outside window', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2024-01-15T19:00:00Z'));
    mockTimezone('Asia/Ulaanbaatar'); // 03:00 UB — outside window

    await processReminderJob(
      makeJob({
        userId: 'u1',
        type: 'morning',
        channels: ['push'],
        pushTokens: ['t1'],
        locale: 'mn',
      }),
    );

    expect(mockPoolEnd).toHaveBeenCalled();
    jest.useRealTimers();
  });
});
