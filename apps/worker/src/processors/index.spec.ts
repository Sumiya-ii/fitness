/**
 * Unit tests for the job dispatcher (index.ts).
 * Verifies that every registered queue name routes to the correct processor,
 * and that unknown queue names are logged rather than crashing.
 */

jest.mock('./photo.processor', () => ({ processPhotoJob: jest.fn().mockResolvedValue({}) }));
jest.mock('./reminders.processor', () => ({
  processReminderJob: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('./coach-memory.processor', () => ({
  processCoachMemoryJob: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('./privacy.processor', () => ({
  processPrivacyJob: jest.fn().mockResolvedValue(undefined),
}));

import { processJob } from './index';
import { QUEUE_NAMES } from '@coach/shared';
import { processPhotoJob } from './photo.processor';
import { processReminderJob } from './reminders.processor';
import { processCoachMemoryJob } from './coach-memory.processor';
import { processPrivacyJob } from './privacy.processor';
import type { Job } from 'bullmq';

function makeJob(name: string): Job {
  return { id: 'job-1', name, data: {} } as unknown as Job;
}

describe('processJob dispatcher', () => {
  beforeEach(() => jest.clearAllMocks());

  it('routes PHOTO_PARSING to processPhotoJob', async () => {
    const job = makeJob('parse-photo');
    await processJob(QUEUE_NAMES.PHOTO_PARSING, job);
    expect(processPhotoJob).toHaveBeenCalledWith(job);
  });

  it('routes REMINDERS to processReminderJob', async () => {
    const job = makeJob('send-reminder');
    await processJob(QUEUE_NAMES.REMINDERS, job);
    expect(processReminderJob).toHaveBeenCalledWith(job);
  });

  it('routes COACH_MEMORY to processCoachMemoryJob', async () => {
    const job = makeJob('refresh-memory');
    await processJob(QUEUE_NAMES.COACH_MEMORY, job);
    expect(processCoachMemoryJob).toHaveBeenCalledWith(job);
  });

  it('routes PRIVACY to processPrivacyJob', async () => {
    const job = makeJob('privacy-request');
    await processJob(QUEUE_NAMES.PRIVACY, job);
    expect(processPrivacyJob).toHaveBeenCalledWith(job);
  });

  it('logs a warning for an unknown queue name instead of throwing', async () => {
    const job = makeJob('mystery-job');
    // Cast through unknown to simulate a bad queue name reaching the dispatcher
    await expect(
      processJob('unknown-queue' as unknown as (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES], job),
    ).resolves.not.toThrow();
    // None of the real processors should have been called
    expect(processPhotoJob).not.toHaveBeenCalled();
    expect(processReminderJob).not.toHaveBeenCalled();
    expect(processCoachMemoryJob).not.toHaveBeenCalled();
    expect(processPrivacyJob).not.toHaveBeenCalled();
  });
});
