/**
 * Unit tests for the STT (Speech-to-Text + Nutrition parsing) processor.
 */

jest.mock('../s3', () => ({
  downloadFromS3: jest.fn(),
  deleteFromS3: jest.fn(),
}));

jest.mock('../db', () => ({
  setVoiceDraftActive: jest.fn(),
  setVoiceDraftCompleted: jest.fn(),
  setVoiceDraftFailed: jest.fn(),
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

    expect(mockSetFailed).toHaveBeenCalledWith('d1', expect.stringContaining('Audio retrieval'));
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
    ).rejects.toThrow('Whisper HTTP 429');

    expect(mockSetFailed).toHaveBeenCalledWith(
      'd1',
      expect.stringContaining('Transcription failed'),
    );

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
});
