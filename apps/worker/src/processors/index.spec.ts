/**
 * Unit tests for the processJob dispatcher.
 *
 * Verifies that each queue name routes to the correct processor
 * and that unknown queues are handled gracefully.
 */

jest.mock('./stt.processor', () => ({ processSttJob: jest.fn() }));
jest.mock('./photo.processor', () => ({ processPhotoJob: jest.fn() }));
jest.mock('./reminders.processor', () => ({ processReminderJob: jest.fn() }));

import { processJob } from './index';
import { processSttJob } from './stt.processor';
import { processPhotoJob } from './photo.processor';
import { processReminderJob } from './reminders.processor';
import { QUEUE_NAMES } from '@coach/shared';
import type { Job } from 'bullmq';

const mockStt = processSttJob as jest.MockedFunction<typeof processSttJob>;
const mockPhoto = processPhotoJob as jest.MockedFunction<typeof processPhotoJob>;
const mockReminder = processReminderJob as jest.MockedFunction<typeof processReminderJob>;

const fakeJob = { id: 'job-1', name: 'test-job', data: {} } as unknown as Job;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('processJob routing', () => {
  it('routes stt-processing to processSttJob', async () => {
    mockStt.mockResolvedValue({
      text: 'hello',
      items: [],
      totalCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
    });
    await processJob(QUEUE_NAMES.STT_PROCESSING, fakeJob);
    expect(mockStt).toHaveBeenCalledWith(fakeJob);
    expect(mockPhoto).not.toHaveBeenCalled();
    expect(mockReminder).not.toHaveBeenCalled();
  });

  it('routes photo-parsing to processPhotoJob', async () => {
    mockPhoto.mockResolvedValue({
      items: [],
      totalCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
    });
    await processJob(QUEUE_NAMES.PHOTO_PARSING, fakeJob);
    expect(mockPhoto).toHaveBeenCalledWith(fakeJob);
    expect(mockStt).not.toHaveBeenCalled();
  });

  it('routes reminders to processReminderJob', async () => {
    mockReminder.mockResolvedValue(undefined);
    await processJob(QUEUE_NAMES.REMINDERS, fakeJob);
    expect(mockReminder).toHaveBeenCalledWith(fakeJob);
    expect(mockStt).not.toHaveBeenCalled();
  });

  it('returns undefined and logs for food-index-sync (stub queue)', async () => {
    const result = await processJob(QUEUE_NAMES.FOOD_INDEX_SYNC, fakeJob);
    expect(result).toBeUndefined();
    expect(console.log).toHaveBeenCalled();
    expect(mockStt).not.toHaveBeenCalled();
  });

  it('returns undefined and logs for data-export (stub queue)', async () => {
    const result = await processJob(QUEUE_NAMES.DATA_EXPORT, fakeJob);
    expect(result).toBeUndefined();
    expect(console.log).toHaveBeenCalled();
  });

  it('returns undefined and logs for webhook-retry (stub queue)', async () => {
    const result = await processJob(QUEUE_NAMES.WEBHOOK_RETRY, fakeJob);
    expect(result).toBeUndefined();
    expect(console.log).toHaveBeenCalled();
  });

  it('returns undefined and logs for analytics (stub queue)', async () => {
    const result = await processJob(QUEUE_NAMES.ANALYTICS, fakeJob);
    expect(result).toBeUndefined();
    expect(console.log).toHaveBeenCalled();
  });

  it('warns and returns undefined for unknown queue name', async () => {
    const result = await processJob('unknown-queue' as never, fakeJob);
    expect(result).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('unknown-queue'));
    expect(mockStt).not.toHaveBeenCalled();
  });
});
