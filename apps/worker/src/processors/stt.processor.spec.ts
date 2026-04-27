/**
 * Unit tests for the STT (Speech-to-Text + Nutrition parsing) processor.
 */

jest.mock('@sentry/node', () => ({
  captureException: jest.fn(),
  init: jest.fn(),
}));

jest.mock('../s3', () => ({
  downloadFromS3: jest.fn(),
  deleteFromS3: jest.fn(),
}));

jest.mock('../db', () => ({
  setVoiceDraftActive: jest.fn(),
  setVoiceDraftCompleted: jest.fn(),
  setVoiceDraftFailed: jest.fn(),
  getCalibrationRatios: jest.fn().mockResolvedValue(new Map()),
}));

jest.mock('openai', () => {
  const mockCreate = jest.fn();
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }));
});

import { processSttJob } from './stt.processor';
import { downloadFromS3, deleteFromS3 } from '../s3';
import { setVoiceDraftActive, setVoiceDraftCompleted, setVoiceDraftFailed } from '../db';
import OpenAI from 'openai';
import type { Job } from 'bullmq';
import * as Sentry from '@sentry/node';

const mockDownloadFromS3 = downloadFromS3 as jest.MockedFunction<typeof downloadFromS3>;
const mockDeleteFromS3 = deleteFromS3 as jest.MockedFunction<typeof deleteFromS3>;
const mockSetActive = setVoiceDraftActive as jest.MockedFunction<typeof setVoiceDraftActive>;
const mockSetCompleted = setVoiceDraftCompleted as jest.MockedFunction<
  typeof setVoiceDraftCompleted
>;
const mockSetFailed = setVoiceDraftFailed as jest.MockedFunction<typeof setVoiceDraftFailed>;

function getOpenAIMock(): jest.Mock {
  const instance = new (OpenAI as unknown as new () => {
    chat: { completions: { create: jest.Mock } };
  })();
  return instance.chat.completions.create;
}

function makeJob(data: Record<string, unknown>): Job {
  return { id: 'job-1', name: 'stt', data } as unknown as Job;
}

let originalEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  jest.clearAllMocks();
  originalEnv = { ...process.env };
  process.env.OPENAI_API_KEY = 'test-openai-key';
  process.env.S3_BUCKET = 'test-bucket';
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  process.env = originalEnv;
  jest.restoreAllMocks();
});

describe('processSttJob', () => {
  it('returns empty result when OPENAI_API_KEY is not set', async () => {
    delete process.env.OPENAI_API_KEY;

    const result = await processSttJob(makeJob({ userId: 'u1', draftId: 'd1' }));

    expect(result.text).toBe('');
    expect(result.items).toEqual([]);
    expect(mockSetFailed).toHaveBeenCalledWith('d1', expect.stringContaining('OPENAI_API_KEY'));
  });

  it('marks draft active and downloads audio from S3', async () => {
    mockDownloadFromS3.mockResolvedValue(Buffer.from('fake-audio'));
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: 'Би бууз идлээ' }),
    } as Response);

    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              mealType: 'lunch',
              items: [
                {
                  name: 'Бууз',
                  quantity: 4,
                  unit: 'piece',
                  grams: 200,
                  calories: 400,
                  protein: 20,
                  carbs: 30,
                  fat: 15,
                  confidence: 0.9,
                },
              ],
            }),
          },
        },
      ],
    });

    const result = await processSttJob(
      makeJob({ userId: 'u1', draftId: 'd1', s3Key: 'audio/test.m4a', locale: 'mn' }),
    );

    expect(mockSetActive).toHaveBeenCalledWith('d1');
    expect(mockDownloadFromS3).toHaveBeenCalledWith('audio/test.m4a');
    expect(result.text).toBe('Би бууз идлээ');
    expect(result.mealType).toBe('lunch');
    expect(result.items).toHaveLength(1);
    expect(result.totalCalories).toBe(400);
    expect(mockSetCompleted).toHaveBeenCalledWith(
      'd1',
      expect.objectContaining({ transcription: 'Би бууз идлээ', mealType: 'lunch' }),
    );
    expect(mockDeleteFromS3).toHaveBeenCalledWith('audio/test.m4a');

    fetchSpy.mockRestore();
  });

  it('uses base64 audio fallback when no S3 key', async () => {
    delete process.env.S3_BUCKET;
    const audioBase64 = Buffer.from('fake-audio').toString('base64');

    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: 'test' }),
    } as Response);

    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '{"items":[]}' } }],
    });

    const result = await processSttJob(makeJob({ userId: 'u1', audioBuffer: audioBase64 }));

    expect(mockDownloadFromS3).not.toHaveBeenCalled();
    expect(result.text).toBe('test');

    fetchSpy.mockRestore();
  });

  it('throws when no audio source is available', async () => {
    delete process.env.S3_BUCKET;

    await expect(processSttJob(makeJob({ userId: 'u1', draftId: 'd1' }))).rejects.toThrow(
      'No audio source',
    );

    expect(mockSetFailed).toHaveBeenCalledWith('d1', 'audio_download_failed');
  });

  it('handles empty transcription result', async () => {
    mockDownloadFromS3.mockResolvedValue(Buffer.from('audio'));
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: '' }),
    } as Response);

    const result = await processSttJob(makeJob({ userId: 'u1', draftId: 'd1', s3Key: 'key' }));

    expect(result.text).toBe('');
    expect(result.items).toEqual([]);
    expect(mockSetCompleted).toHaveBeenCalledWith(
      'd1',
      expect.objectContaining({ transcription: '', parsedItems: [] }),
    );

    fetchSpy.mockRestore();
  });

  it('throws when Whisper API returns non-OK response', async () => {
    mockDownloadFromS3.mockResolvedValue(Buffer.from('audio'));
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => 'Rate limited',
    } as Response);

    await expect(
      processSttJob(makeJob({ userId: 'u1', draftId: 'd1', s3Key: 'key' })),
    ).rejects.toThrow('transcription_failed');

    expect(mockSetFailed).toHaveBeenCalledWith('d1', 'transcription_failed');

    fetchSpy.mockRestore();
  });

  it('returns transcription with empty items when nutrition parse fails', async () => {
    mockDownloadFromS3.mockResolvedValue(Buffer.from('audio'));
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: 'some food' }),
    } as Response);

    const mockCreate = getOpenAIMock();
    mockCreate.mockRejectedValue(new Error('OpenAI error'));

    const result = await processSttJob(makeJob({ userId: 'u1', s3Key: 'key' }));

    expect(result.text).toBe('some food');
    expect(result.items).toEqual([]);
    expect(result.totalCalories).toBe(0);

    fetchSpy.mockRestore();
  });

  it('clamps confidence to 0–1 range', async () => {
    mockDownloadFromS3.mockResolvedValue(Buffer.from('audio'));
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: 'food' }),
    } as Response);

    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              items: [
                { name: 'A', calories: 100, protein: 5, carbs: 10, fat: 3, confidence: 1.5 },
                { name: 'B', calories: 200, protein: 10, carbs: 20, fat: 6, confidence: -0.5 },
              ],
            }),
          },
        },
      ],
    });

    const result = await processSttJob(makeJob({ userId: 'u1', s3Key: 'key' }));

    expect(result.items[0].confidence).toBe(1);
    expect(result.items[1].confidence).toBe(0);

    fetchSpy.mockRestore();
  });

  it('omits language hint for non-English locales (auto-detect)', async () => {
    mockDownloadFromS3.mockResolvedValue(Buffer.from('audio'));
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: 'test' }),
    } as Response);

    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '{"items":[]}' } }],
    });

    await processSttJob(makeJob({ userId: 'u1', s3Key: 'key' }));

    const callArgs = fetchSpy.mock.calls[0];
    const body = callArgs[1]?.body as FormData;
    // Mongolian is not supported by the language parameter — should be omitted
    expect(body.get('language')).toBeNull();
    expect(body.get('model')).toBe('gpt-4o-transcribe');

    fetchSpy.mockRestore();
  });

  it('skips draft operations when draftId is not provided', async () => {
    mockDownloadFromS3.mockResolvedValue(Buffer.from('audio'));
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: 'food' }),
    } as Response);

    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '{"items":[]}' } }],
    });

    await processSttJob(makeJob({ userId: 'u1', s3Key: 'key' }));

    expect(mockSetActive).not.toHaveBeenCalled();
    expect(mockSetCompleted).not.toHaveBeenCalled();
    expect(mockSetFailed).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it('still cleans up S3 when draftId is absent', async () => {
    mockDownloadFromS3.mockResolvedValue(Buffer.from('audio'));
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: 'food' }),
    } as Response);

    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '{"items":[]}' } }],
    });

    await processSttJob(makeJob({ userId: 'u1', s3Key: 'audio.m4a' }));

    expect(mockDeleteFromS3).toHaveBeenCalledWith('audio.m4a');

    fetchSpy.mockRestore();
  });

  it('passes language=mn hint to Whisper for Mongolian locale', async () => {
    mockDownloadFromS3.mockResolvedValue(Buffer.from('audio'));
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: 'тест' }),
    } as Response);

    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({ choices: [{ message: { content: '{"items":[]}' } }] });

    await processSttJob(makeJob({ userId: 'u1', s3Key: 'key', locale: 'mn' }));

    const body = fetchSpy.mock.calls[0][1]?.body as FormData;
    expect(body.get('language')).toBe('mn');
    fetchSpy.mockRestore();
  });

  it('persists optional micronutrients (sugar/sodium/saturatedFat) to draft', async () => {
    mockDownloadFromS3.mockResolvedValue(Buffer.from('audio'));
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: 'хуушуур идлээ' }),
    } as Response);

    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              items: [
                {
                  name: 'Хуушуур',
                  quantity: 2,
                  unit: 'piece',
                  grams: 100,
                  calories: 240,
                  protein: 12,
                  carbs: 18,
                  fat: 12,
                  sugar: 1,
                  sodium: 380,
                  saturatedFat: 3.5,
                  confidence: 0.9,
                },
              ],
            }),
          },
        },
      ],
    });

    const result = await processSttJob(
      makeJob({ userId: 'u1', draftId: 'd1', s3Key: 'key', locale: 'mn' }),
    );

    expect(result.totalSugar).toBe(1);
    expect(result.totalSodium).toBe(380);
    expect(result.totalSaturatedFat).toBe(3.5);
    expect(mockSetCompleted).toHaveBeenCalledWith(
      'd1',
      expect.objectContaining({ totalSugar: 1, totalSodium: 380, totalSaturatedFat: 3.5 }),
    );
    fetchSpy.mockRestore();
  });

  it('returns totalSugar=null when no item has sugar', async () => {
    mockDownloadFromS3.mockResolvedValue(Buffer.from('audio'));
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: 'food' }),
    } as Response);

    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              items: [
                {
                  name: 'X',
                  quantity: 1,
                  unit: 'piece',
                  grams: 100,
                  calories: 200,
                  protein: 10,
                  carbs: 10,
                  fat: 10,
                  confidence: 0.9,
                },
              ],
            }),
          },
        },
      ],
    });

    const result = await processSttJob(makeJob({ userId: 'u1', s3Key: 'key' }));
    expect(result.totalSugar).toBeNull();
    expect(result.totalSodium).toBeNull();
    expect(result.totalSaturatedFat).toBeNull();
    fetchSpy.mockRestore();
  });

  it('generates and persists a clarification when shouldAskFollowUp triggers', async () => {
    mockDownloadFromS3.mockResolvedValue(Buffer.from('audio'));
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: 'хуушуур идлээ' }),
    } as Response);

    const mockCreate = getOpenAIMock();
    // First call: nutrition parse with ambiguity flag
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              items: [
                {
                  name: 'Хуушуур',
                  quantity: 2,
                  unit: 'piece',
                  grams: 100,
                  calories: 240,
                  protein: 12,
                  carbs: 18,
                  fat: 12,
                  confidence: 0.8,
                  ambiguity: 'meat_type',
                },
              ],
            }),
          },
        },
      ],
    });
    // Second call: clarification generation
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              question: 'Хуушуур юутай байсан бэ?',
              options: [
                { label: 'Үхрийн мах', patch: { name: 'Хуушуур (үхэр)', calories: 240 } },
                { label: 'Хонины мах', patch: { name: 'Хуушуур (хонь)', calories: 280 } },
                { label: 'Алгасах', patch: null },
              ],
            }),
          },
        },
      ],
    });

    const result = await processSttJob(
      makeJob({ userId: 'u1', draftId: 'd1', s3Key: 'key', locale: 'mn' }),
    );

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(result.clarification).toBeDefined();
    expect(result.clarification?.reason).toBe('meat_type_ambiguous');
    expect(result.clarification?.options).toHaveLength(3);
    expect(mockSetCompleted).toHaveBeenCalledWith(
      'd1',
      expect.objectContaining({
        clarification: expect.objectContaining({ reason: 'meat_type_ambiguous' }),
      }),
    );
    fetchSpy.mockRestore();
  });

  it('does not generate clarification when items are clean and high-confidence', async () => {
    mockDownloadFromS3.mockResolvedValue(Buffer.from('audio'));
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: 'би 4 бууз идлээ' }),
    } as Response);

    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              items: [
                {
                  name: 'Бууз',
                  quantity: 4,
                  unit: 'piece',
                  grams: 200,
                  calories: 360,
                  protein: 28,
                  carbs: 24,
                  fat: 16,
                  confidence: 0.92,
                },
              ],
            }),
          },
        },
      ],
    });

    const result = await processSttJob(
      makeJob({ userId: 'u1', draftId: 'd1', s3Key: 'key', locale: 'mn' }),
    );

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(result.clarification).toBeUndefined();
  });

  it('still completes the job when clarification generation fails (best-effort UX)', async () => {
    mockDownloadFromS3.mockResolvedValue(Buffer.from('audio'));
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: 'мах идлээ' }),
    } as Response);

    const mockCreate = getOpenAIMock();
    // Nutrition parse OK with low conf trigger
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              items: [
                {
                  name: 'мах',
                  quantity: 1,
                  unit: 'serving',
                  grams: 150,
                  calories: 400,
                  protein: 30,
                  carbs: 0,
                  fat: 30,
                  confidence: 0.55,
                },
              ],
            }),
          },
        },
      ],
    });
    // Clarification call throws
    mockCreate.mockRejectedValueOnce(new Error('rate limited'));

    const result = await processSttJob(
      makeJob({ userId: 'u1', draftId: 'd1', s3Key: 'key', locale: 'mn' }),
    );

    expect(result.items).toHaveLength(1);
    expect(result.clarification).toBeUndefined();
    expect(mockSetCompleted).toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('surfaces nutrition-parse failure as parseWarning + errorMessage on completed draft', async () => {
    mockDownloadFromS3.mockResolvedValue(Buffer.from('audio'));
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: 'би хоол идлээ' }),
    } as Response);

    const mockCreate = getOpenAIMock();
    mockCreate.mockRejectedValue(new Error('OpenAI 503'));

    const result = await processSttJob(
      makeJob({ userId: 'u1', draftId: 'd1', s3Key: 'key', locale: 'mn' }),
    );

    expect(result.text).toBe('би хоол идлээ');
    expect(result.items).toEqual([]);
    expect(result.parseWarning).toBe('nutrition_parse_failed');
    expect(mockSetCompleted).toHaveBeenCalledWith(
      'd1',
      expect.objectContaining({
        transcription: 'би хоол идлээ',
        parsedItems: [],
        errorMessage: 'nutrition_parse_failed',
      }),
    );
    fetchSpy.mockRestore();
  });

  it('defaults missing item fields to safe values', async () => {
    mockDownloadFromS3.mockResolvedValue(Buffer.from('audio'));
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: 'food' }),
    } as Response);

    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              items: [{ name: 'X', calories: 100, protein: 5, carbs: 10, fat: 3 }],
            }),
          },
        },
      ],
    });

    const result = await processSttJob(makeJob({ userId: 'u1', s3Key: 'key' }));

    expect(result.items[0].quantity).toBe(1);
    expect(result.items[0].unit).toBe('serving');
    expect(result.items[0].grams).toBe(0);
    expect(result.items[0].confidence).toBe(0.7);

    fetchSpy.mockRestore();
  });

  it('scales item nutrition by the user calibration ratio for known foods', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const db = require('../db') as { getCalibrationRatios: jest.Mock };
    db.getCalibrationRatios.mockResolvedValueOnce(new Map([['mn_buuz', 0.78]]));

    mockDownloadFromS3.mockResolvedValue(Buffer.from('audio'));
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: 'Би бууз идлээ' }),
    } as Response);

    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              mealType: 'lunch',
              items: [
                {
                  name: 'Бууз',
                  quantity: 4,
                  unit: 'piece',
                  grams: 200,
                  calories: 400,
                  protein: 20,
                  carbs: 30,
                  fat: 15,
                  confidence: 0.9,
                },
              ],
            }),
          },
        },
      ],
    });

    const result = await processSttJob(
      makeJob({ userId: 'u1', draftId: 'd1', s3Key: 'audio/test.m4a' }),
    );

    expect(db.getCalibrationRatios).toHaveBeenCalledWith('u1', ['mn_buuz']);
    // 400 * 0.78 = 312
    expect(result.items[0].calories).toBeCloseTo(312, 0);
    expect(result.totalCalories).toBe(312);
    // protein 20 * 0.78 = 15.6
    expect(result.items[0].protein).toBeCloseTo(15.6, 1);

    fetchSpy.mockRestore();
  });

  it('locale en: passes language=en to Whisper and returns items', async () => {
    mockDownloadFromS3.mockResolvedValue(Buffer.from('audio'));
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: 'I had rice' }),
    } as Response);

    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              items: [
                {
                  name: 'Rice',
                  quantity: 1,
                  unit: 'cup',
                  grams: 200,
                  calories: 250,
                  protein: 5,
                  carbs: 50,
                  fat: 1,
                  confidence: 0.9,
                },
              ],
            }),
          },
        },
      ],
    });

    const result = await processSttJob(makeJob({ userId: 'u1', s3Key: 'key', locale: 'en' }));

    const body = fetchSpy.mock.calls[0][1]?.body as FormData;
    expect(body.get('language')).toBe('en');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe('Rice');

    fetchSpy.mockRestore();
  });

  it('unknown locale: omits language field (no auto-detection hint)', async () => {
    mockDownloadFromS3.mockResolvedValue(Buffer.from('audio'));
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: 'bonjour' }),
    } as Response);

    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({ choices: [{ message: { content: '{"items":[]}' } }] });

    await processSttJob(makeJob({ userId: 'u1', s3Key: 'key', locale: 'fr' }));

    const body = fetchSpy.mock.calls[0][1]?.body as FormData;
    expect(body.get('language')).toBeNull();

    fetchSpy.mockRestore();
  });

  it('calls Sentry with stage=whisper_transcription on non-OK Whisper response', async () => {
    mockDownloadFromS3.mockResolvedValue(Buffer.from('audio'));
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    } as Response);
    const mockCaptureException = Sentry.captureException as jest.Mock;
    mockCaptureException.mockClear();

    await expect(
      processSttJob(makeJob({ userId: 'u1', draftId: 'd1', s3Key: 'key' })),
    ).rejects.toThrow('transcription_failed');

    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ tags: { processor: 'stt', stage: 'whisper_transcription' } }),
    );
  });

  it('calls Sentry with stage=nutrition_parse on nutrition parse failure', async () => {
    mockDownloadFromS3.mockResolvedValue(Buffer.from('audio'));
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: 'some food' }),
    } as Response);
    const mockCreate = getOpenAIMock();
    mockCreate.mockRejectedValue(new Error('OpenAI 503'));
    const mockCaptureException = Sentry.captureException as jest.Mock;
    mockCaptureException.mockClear();

    await processSttJob(makeJob({ userId: 'u1', s3Key: 'key' }));

    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ tags: { processor: 'stt', stage: 'nutrition_parse' } }),
    );
  });

  it('rejects with transcription_timeout after 25s and marks draft failed', async () => {
    jest.useFakeTimers();
    mockDownloadFromS3.mockResolvedValue(Buffer.from('audio'));
    jest.spyOn(global, 'fetch').mockReturnValueOnce(new Promise(() => {}) as Promise<Response>);

    // Attach rejection handler before advancing timers to avoid unhandled rejection warning
    const jobPromise = processSttJob(makeJob({ userId: 'u1', draftId: 'd1', s3Key: 'key' }));
    const caught = jobPromise.catch((e: Error) => e);

    await jest.runAllTimersAsync();

    const err = await caught;
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe('transcription_timeout');
    expect(mockSetFailed).toHaveBeenCalledWith('d1', 'transcription_timeout');

    jest.useRealTimers();
  });

  it('does not call Sentry for expected NoSuchKey audio miss', async () => {
    const noSuchKeyErr = Object.assign(new Error('NoSuchKey'), { name: 'NoSuchKey' });
    mockDownloadFromS3.mockRejectedValue(noSuchKeyErr);
    const mockCaptureException = Sentry.captureException as jest.Mock;
    mockCaptureException.mockClear();

    await expect(
      processSttJob(makeJob({ userId: 'u1', draftId: 'd1', s3Key: 'key' })),
    ).rejects.toThrow('NoSuchKey');

    const audioRetrievalCall = mockCaptureException.mock.calls.find(
      (call) =>
        call[1] &&
        typeof call[1] === 'object' &&
        'tags' in call[1] &&
        (call[1] as { tags: { stage: string } }).tags?.stage === 'audio_retrieval',
    );
    expect(audioRetrievalCall).toBeUndefined();
  });

  it('passes through items unchanged when no calibration exists', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const db = require('../db') as { getCalibrationRatios: jest.Mock };
    db.getCalibrationRatios.mockResolvedValueOnce(new Map());

    mockDownloadFromS3.mockResolvedValue(Buffer.from('audio'));
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: 'Би бууз идлээ' }),
    } as Response);

    const mockCreate = getOpenAIMock();
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              items: [
                {
                  name: 'Бууз',
                  quantity: 4,
                  unit: 'piece',
                  grams: 200,
                  calories: 400,
                  protein: 20,
                  carbs: 30,
                  fat: 15,
                  confidence: 0.9,
                },
              ],
            }),
          },
        },
      ],
    });

    const result = await processSttJob(makeJob({ userId: 'u1', s3Key: 'k' }));
    expect(result.items[0].calories).toBe(400);

    fetchSpy.mockRestore();
  });
});
