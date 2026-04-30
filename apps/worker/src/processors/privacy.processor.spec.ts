/**
 * Unit tests for the Privacy processor (data export + account deletion).
 *
 * Test categories covered:
 * 1. Missing env vars (DATABASE_URL, S3_BUCKET, TELEGRAM_BOT_TOKEN)
 * 2. Happy path — export: collect, upload, presign, notify
 * 3. Both delivery channels (Telegram + push) for export notification
 * 4. No deliverable channels — export completes without notification crash
 * 5. Locale handling — mn (default), en, undefined
 * 6. AI fallback — N/A (no AI in this processor)
 * 7. External service errors — S3 failure, Telegram failure, Push failure
 * 8. Error logging — logMessage called with status:'failed' on delivery errors
 * 9. Edge case data — missing fields in job.data, deletion already-processed guard
 */

// ── Mock setup (must precede imports) ─────────────────────────────────────────

const mockPoolQuery = jest.fn();
const mockPoolEnd = jest.fn();
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: mockPoolQuery,
    end: mockPoolEnd,
  })),
}));

jest.mock('telegraf', () => ({
  Telegraf: jest.fn().mockImplementation(() => ({
    telegram: { sendMessage: jest.fn().mockResolvedValue(undefined) },
  })),
}));

jest.mock('../s3', () => ({
  uploadToS3: jest.fn().mockResolvedValue(undefined),
  getPresignedUrl: jest.fn().mockResolvedValue('https://s3.example.com/export.json?sig=abc'),
  deleteFromS3: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../expo-push', () => ({ sendExpoPush: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../message-log.service', () => ({ logMessage: jest.fn().mockResolvedValue(undefined) }));

// ── Imports ───────────────────────────────────────────────────────────────────

import { processPrivacyJob } from './privacy.processor';
import { Telegraf } from 'telegraf';
import { uploadToS3, getPresignedUrl, deleteFromS3 } from '../s3';
import { sendExpoPush } from '../expo-push';
import { logMessage } from '../message-log.service';
import type { Job } from 'bullmq';

// ── Typed mocks ───────────────────────────────────────────────────────────────

const mockUploadToS3 = uploadToS3 as jest.MockedFunction<typeof uploadToS3>;
const mockGetPresignedUrl = getPresignedUrl as jest.MockedFunction<typeof getPresignedUrl>;
const mockDeleteFromS3 = deleteFromS3 as jest.MockedFunction<typeof deleteFromS3>;
const mockSendExpoPush = sendExpoPush as jest.MockedFunction<typeof sendExpoPush>;
const mockLogMessage = logMessage as jest.MockedFunction<typeof logMessage>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeJob(data: Record<string, unknown>): Job {
  return {
    id: 'job-42',
    name: 'privacy',
    data,
    attemptsMade: 1,
    opts: { attempts: 3 },
  } as unknown as Job;
}

/** 1 idempotency check + 18 data-collection queries + 1 UPDATE processing + 3 delivery-info queries + 1 UPDATE completed */
const EXPORT_QUERY_COUNT = 1 + 18 + 1 + 3 + 1;

/**
 * Set up the standard sequence of pool.query responses for a successful export.
 * processExport issues 1 idempotency SELECT, 1 UPDATE processing, collectUserData issues 18
 * parallel queries, 1 UPDATE completed, then getUserDeliveryInfo issues 3 queries.
 */
function setupExportMocks(
  opts: {
    pushTokens?: string[];
    chatId?: string | null;
    locale?: string;
  } = {},
) {
  const { pushTokens = ['expo-token-1'], chatId = 'tg-chat-123', locale = 'mn' } = opts;

  // 1. Idempotency check — return 'pending' so execution proceeds
  mockPoolQuery.mockResolvedValueOnce({ rows: [{ status: 'pending' }] });

  // 2. UPDATE status = 'processing'
  mockPoolQuery.mockResolvedValueOnce({ rows: [] });

  // 3–20. collectUserData (18 parallel queries — order matches Promise.all)
  for (let i = 0; i < 18; i++) {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });
  }

  // 21. UPDATE status = 'completed' + result_url
  mockPoolQuery.mockResolvedValueOnce({ rows: [] });

  // 22. device_tokens query (getUserDeliveryInfo)
  mockPoolQuery.mockResolvedValueOnce({
    rows: pushTokens.map((t) => ({ token: t })),
  });

  // 23. telegram_links query
  mockPoolQuery.mockResolvedValueOnce({
    rows: chatId ? [{ chat_id: chatId }] : [],
  });

  // 24. profiles locale query
  mockPoolQuery.mockResolvedValueOnce({
    rows: locale ? [{ locale }] : [],
  });
}

/** Deletion happy-path: status check → processing update → voice keys → transaction deletes → completed update → user delete → commit */
function setupDeletionMocks(status = 'pending') {
  // 1. status check
  mockPoolQuery.mockResolvedValueOnce({ rows: [{ status }] });
  if (status !== 'pending') return;
  // 2. UPDATE processing
  mockPoolQuery.mockResolvedValueOnce({ rows: [] });
  // 3. voice keys
  mockPoolQuery.mockResolvedValueOnce({ rows: [{ s3_key: 'voice/u1/file.webm' }] });
  // 4. BEGIN
  mockPoolQuery.mockResolvedValueOnce({ rows: [] });
  // 5–17: DELETE statements (13 tables)
  for (let i = 0; i < 13; i++) {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });
  }
  // 18. UPDATE privacy_requests completed
  mockPoolQuery.mockResolvedValueOnce({ rows: [] });
  // 19. DELETE users
  mockPoolQuery.mockResolvedValueOnce({ rows: [] });
  // 20. COMMIT
  mockPoolQuery.mockResolvedValueOnce({ rows: [] });
}

let originalEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  jest.clearAllMocks();
  originalEnv = { ...process.env };
  process.env.DATABASE_URL = 'postgres://localhost/test';
  process.env.S3_BUCKET = 'test-bucket';
  process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
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
  it('skips when DATABASE_URL is not set', async () => {
    delete process.env.DATABASE_URL;

    await processPrivacyJob(makeJob({ requestId: 'req-1', userId: 'u1', requestType: 'export' }));

    expect(mockPoolQuery).not.toHaveBeenCalled();
  });

  it('completes without S3 URL when S3_BUCKET is not set', async () => {
    delete process.env.S3_BUCKET;

    // 1. Idempotency check
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ status: 'pending' }] });
    // 2. UPDATE processing
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });
    // 3–20. collectUserData
    for (let i = 0; i < 18; i++) {
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });
    }
    // 21. UPDATE completed (no result_url)
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });

    await processPrivacyJob(makeJob({ requestId: 'req-1', userId: 'u1', requestType: 'export' }));

    expect(mockUploadToS3).not.toHaveBeenCalled();
    expect(mockGetPresignedUrl).not.toHaveBeenCalled();
    expect(mockSendExpoPush).not.toHaveBeenCalled();
    expect(mockPoolEnd).toHaveBeenCalled();
  });

  it('skips Telegram delivery when TELEGRAM_BOT_TOKEN is not set', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    setupExportMocks({ chatId: 'tg-chat-1', pushTokens: [] });

    await processPrivacyJob(makeJob({ requestId: 'req-1', userId: 'u1', requestType: 'export' }));

    const TelegrafMock = Telegraf as unknown as jest.Mock;
    expect(TelegrafMock).not.toHaveBeenCalled();
  });
});

// ── 2. Happy path — export ────────────────────────────────────────────────────

describe('export happy path', () => {
  it('collects data, uploads to S3, generates presigned URL, updates DB', async () => {
    setupExportMocks();

    await processPrivacyJob(makeJob({ requestId: 'req-1', userId: 'u1', requestType: 'export' }));

    expect(mockUploadToS3).toHaveBeenCalledWith(
      'exports/u1/req-1.json',
      expect.any(Buffer),
      'application/json',
    );
    expect(mockGetPresignedUrl).toHaveBeenCalledWith('exports/u1/req-1.json', 7 * 24 * 60 * 60);

    // DB update must include result_url
    const completedCall = mockPoolQuery.mock.calls.find(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes('result_url'),
    );
    expect(completedCall).toBeDefined();
    expect(completedCall![1]).toContain('https://s3.example.com/export.json?sig=abc');

    expect(mockPoolEnd).toHaveBeenCalled();
  });

  it('queries all 18 data tables', async () => {
    setupExportMocks({ pushTokens: [], chatId: null });

    await processPrivacyJob(makeJob({ requestId: 'req-1', userId: 'u1', requestType: 'export' }));

    // Total calls: 1 idempotency check + 1 UPDATE processing + 18 data queries + 1 UPDATE completed + 3 delivery-info
    expect(mockPoolQuery).toHaveBeenCalledTimes(EXPORT_QUERY_COUNT);
  });

  it('skips re-processing when export is already completed (idempotency)', async () => {
    // Idempotency check returns 'completed' — should bail out immediately
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ status: 'completed' }] });

    await processPrivacyJob(makeJob({ requestId: 'req-1', userId: 'u1', requestType: 'export' }));

    expect(mockUploadToS3).not.toHaveBeenCalled();
    // Only the idempotency SELECT should have been called
    expect(mockPoolQuery).toHaveBeenCalledTimes(1);
  });
});

// ── 3. Both delivery channels ─────────────────────────────────────────────────

describe('export delivery — both channels', () => {
  it('delivers via both Telegram and push when both are available', async () => {
    setupExportMocks({ pushTokens: ['token-1'], chatId: 'chat-1', locale: 'mn' });

    await processPrivacyJob(makeJob({ requestId: 'req-1', userId: 'u1', requestType: 'export' }));

    const TelegrafMock = Telegraf as unknown as jest.Mock;
    expect(TelegrafMock).toHaveBeenCalledWith('test-bot-token');
    const botInstance = TelegrafMock.mock.results[0].value;
    expect(botInstance.telegram.sendMessage).toHaveBeenCalledWith(
      'chat-1',
      expect.stringContaining('https://s3.example.com/export.json?sig=abc'),
      { parse_mode: 'HTML' },
    );

    expect(mockSendExpoPush).toHaveBeenCalledWith(
      ['token-1'],
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ type: 'data_export', url: expect.any(String) }),
    );

    // logMessage called once for each channel
    expect(mockLogMessage).toHaveBeenCalledTimes(2);
    expect(mockLogMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'telegram', status: 'sent', userId: 'u1' }),
    );
    expect(mockLogMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'push', status: 'sent', userId: 'u1' }),
    );
  });

  it('delivers via Telegram only when no push tokens', async () => {
    setupExportMocks({ pushTokens: [], chatId: 'chat-1' });

    await processPrivacyJob(makeJob({ requestId: 'req-1', userId: 'u1', requestType: 'export' }));

    expect(mockSendExpoPush).not.toHaveBeenCalled();
    expect(mockLogMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'telegram', status: 'sent' }),
    );
  });

  it('delivers via push only when no chatId', async () => {
    setupExportMocks({ pushTokens: ['token-1'], chatId: null });

    await processPrivacyJob(makeJob({ requestId: 'req-1', userId: 'u1', requestType: 'export' }));

    const TelegrafMock = Telegraf as unknown as jest.Mock;
    expect(TelegrafMock).not.toHaveBeenCalled();
    expect(mockSendExpoPush).toHaveBeenCalled();
    expect(mockLogMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'push', status: 'sent' }),
    );
  });
});

// ── 4. No deliverable channels ────────────────────────────────────────────────

describe('export delivery — no channels', () => {
  it('completes export without crashing when user has no tokens and no chatId', async () => {
    setupExportMocks({ pushTokens: [], chatId: null });

    await expect(
      processPrivacyJob(makeJob({ requestId: 'req-1', userId: 'u1', requestType: 'export' })),
    ).resolves.toBeUndefined();

    expect(mockSendExpoPush).not.toHaveBeenCalled();
    expect(mockLogMessage).not.toHaveBeenCalled();
  });
});

// ── 5. Locale handling ────────────────────────────────────────────────────────

describe('locale handling', () => {
  it('sends Mongolian text when locale is mn', async () => {
    setupExportMocks({ pushTokens: ['t1'], chatId: null, locale: 'mn' });

    await processPrivacyJob(makeJob({ requestId: 'req-1', userId: 'u1', requestType: 'export' }));

    const [, title, body] = (mockSendExpoPush as jest.Mock).mock.calls[0];
    expect(title).toContain('Өгөгдөл экспортлогдлоо');
    expect(body).toContain('7 хоногийн');
  });

  it('sends English text when locale is en', async () => {
    setupExportMocks({ pushTokens: ['t1'], chatId: null, locale: 'en' });

    await processPrivacyJob(makeJob({ requestId: 'req-1', userId: 'u1', requestType: 'export' }));

    const [, title, body] = (mockSendExpoPush as jest.Mock).mock.calls[0];
    expect(title).toContain('Data Export Ready');
    expect(body).toContain('7 days');
  });

  it('defaults to Mongolian when locale is not set in profile', async () => {
    setupExportMocks({ pushTokens: ['t1'], chatId: null, locale: '' });

    await processPrivacyJob(makeJob({ requestId: 'req-1', userId: 'u1', requestType: 'export' }));

    const [, title] = (mockSendExpoPush as jest.Mock).mock.calls[0];
    expect(title).toContain('Өгөгдөл экспортлогдлоо');
  });

  it('sends Mongolian Telegram text when locale is mn', async () => {
    setupExportMocks({ pushTokens: [], chatId: 'chat-1', locale: 'mn' });

    await processPrivacyJob(makeJob({ requestId: 'req-1', userId: 'u1', requestType: 'export' }));

    const TelegrafMock = Telegraf as unknown as jest.Mock;
    const botInstance = TelegrafMock.mock.results[0].value;
    const [, text] = botInstance.telegram.sendMessage.mock.calls[0];
    expect(text).toContain('Татаж авах');
  });

  it('sends English Telegram text when locale is en', async () => {
    setupExportMocks({ pushTokens: [], chatId: 'chat-1', locale: 'en' });

    await processPrivacyJob(makeJob({ requestId: 'req-1', userId: 'u1', requestType: 'export' }));

    const TelegrafMock = Telegraf as unknown as jest.Mock;
    const botInstance = TelegrafMock.mock.results[0].value;
    const [, text] = botInstance.telegram.sendMessage.mock.calls[0];
    expect(text).toContain('Download');
  });
});

// ── 7. External service errors ────────────────────────────────────────────────

describe('external service errors', () => {
  it('throws when S3 upload fails', async () => {
    // 1. UPDATE processing
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });
    // 2–19. collectUserData
    for (let i = 0; i < 18; i++) {
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });
    }
    // mark failed
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });

    mockUploadToS3.mockRejectedValueOnce(new Error('S3 network error'));

    await expect(
      processPrivacyJob(makeJob({ requestId: 'req-1', userId: 'u1', requestType: 'export' })),
    ).rejects.toThrow('S3 network error');

    expect(mockPoolEnd).toHaveBeenCalled();
  });

  it('does not throw when Telegram delivery fails — logs failure instead', async () => {
    setupExportMocks({ pushTokens: [], chatId: 'chat-1', locale: 'mn' });

    (Telegraf as unknown as jest.Mock).mockImplementationOnce(() => ({
      telegram: { sendMessage: jest.fn().mockRejectedValue(new Error('Telegram 403')) },
    }));

    await expect(
      processPrivacyJob(makeJob({ requestId: 'req-1', userId: 'u1', requestType: 'export' })),
    ).resolves.toBeUndefined();
  });

  it('does not throw when push delivery fails — logs failure instead', async () => {
    setupExportMocks({ pushTokens: ['t1'], chatId: null, locale: 'mn' });
    mockSendExpoPush.mockRejectedValueOnce(new Error('Expo 500'));

    await expect(
      processPrivacyJob(makeJob({ requestId: 'req-1', userId: 'u1', requestType: 'export' })),
    ).resolves.toBeUndefined();
  });

  it('marks request as failed in DB when job throws', async () => {
    // 1. UPDATE processing
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });
    // 2–19. collectUserData
    for (let i = 0; i < 18; i++) {
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });
    }
    // S3 upload will throw — next pool call is the failed-status update
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });

    mockUploadToS3.mockRejectedValueOnce(new Error('S3 down'));

    await expect(
      processPrivacyJob(makeJob({ requestId: 'req-1', userId: 'u1', requestType: 'export' })),
    ).rejects.toThrow('S3 down');

    const failedCall = mockPoolQuery.mock.calls.find(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes("status = 'failed'"),
    );
    expect(failedCall).toBeDefined();
  });
});

// ── 8. Error logging ──────────────────────────────────────────────────────────

describe('error logging', () => {
  it('calls logMessage with status:failed when Telegram throws', async () => {
    setupExportMocks({ pushTokens: [], chatId: 'chat-1', locale: 'mn' });

    (Telegraf as unknown as jest.Mock).mockImplementationOnce(() => ({
      telegram: {
        sendMessage: jest.fn().mockRejectedValue(new Error('Bot blocked by user')),
      },
    }));

    await processPrivacyJob(makeJob({ requestId: 'req-1', userId: 'u1', requestType: 'export' }));

    expect(mockLogMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'telegram',
        status: 'failed',
        errorMessage: 'Bot blocked by user',
        userId: 'u1',
      }),
    );
  });

  it('calls logMessage with status:failed when push throws', async () => {
    setupExportMocks({ pushTokens: ['t1'], chatId: null, locale: 'en' });
    mockSendExpoPush.mockRejectedValueOnce(new Error('Push quota exceeded'));

    await processPrivacyJob(makeJob({ requestId: 'req-1', userId: 'u1', requestType: 'export' }));

    expect(mockLogMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'push',
        status: 'failed',
        errorMessage: 'Push quota exceeded',
        userId: 'u1',
      }),
    );
  });
});

// ── 9. Edge case data ─────────────────────────────────────────────────────────

describe('edge case data', () => {
  it('skips when job data is missing requestId', async () => {
    await processPrivacyJob(makeJob({ userId: 'u1', requestType: 'export' }));
    expect(mockPoolQuery).not.toHaveBeenCalled();
  });

  it('skips when job data is missing userId', async () => {
    await processPrivacyJob(makeJob({ requestId: 'req-1', requestType: 'export' }));
    expect(mockPoolQuery).not.toHaveBeenCalled();
  });

  it('skips when requestType is unknown', async () => {
    // Only the Pool is created and ended; no queries
    await processPrivacyJob(makeJob({ requestId: 'r', userId: 'u1', requestType: 'unknown' }));
    expect(mockUploadToS3).not.toHaveBeenCalled();
    expect(mockPoolEnd).toHaveBeenCalled();
  });

  it('skips deletion when request status is not pending', async () => {
    setupDeletionMocks('processing');

    await processPrivacyJob(makeJob({ requestId: 'req-1', userId: 'u1', requestType: 'deletion' }));

    // Only the status check query ran, no deletes
    expect(mockPoolQuery).toHaveBeenCalledTimes(1);
    expect(mockPoolEnd).toHaveBeenCalled();
  });

  it('deletion: executes transaction and cleans up S3 voice files', async () => {
    setupDeletionMocks();

    await processPrivacyJob(makeJob({ requestId: 'req-1', userId: 'u1', requestType: 'deletion' }));

    expect(mockDeleteFromS3).toHaveBeenCalledWith('voice/u1/file.webm');
    expect(mockDeleteFromS3).toHaveBeenCalledWith('exports/u1/req-1.json');
    expect(mockPoolEnd).toHaveBeenCalled();
  });

  it('deletion: rolls back and rethrows on DB error in transaction', async () => {
    // status check → pending
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ status: 'pending' }] });
    // UPDATE processing
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });
    // voice keys
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });
    // BEGIN
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });
    // First DELETE fails
    mockPoolQuery.mockRejectedValueOnce(new Error('FK violation'));
    // ROLLBACK
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });
    // mark failed
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });

    await expect(
      processPrivacyJob(makeJob({ requestId: 'req-1', userId: 'u1', requestType: 'deletion' })),
    ).rejects.toThrow('FK violation');

    const rollbackCall = mockPoolQuery.mock.calls.find((c) => c[0] === 'ROLLBACK');
    expect(rollbackCall).toBeDefined();
    expect(mockPoolEnd).toHaveBeenCalled();
  });

  it('export with multiple push tokens delivers to all', async () => {
    setupExportMocks({ pushTokens: ['t1', 't2', 't3'], chatId: null });

    await processPrivacyJob(makeJob({ requestId: 'req-1', userId: 'u1', requestType: 'export' }));

    expect(mockSendExpoPush).toHaveBeenCalledWith(
      ['t1', 't2', 't3'],
      expect.any(String),
      expect.any(String),
      expect.any(Object),
    );
  });
});
