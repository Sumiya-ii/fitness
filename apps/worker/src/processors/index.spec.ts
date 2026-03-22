/**
 * Unit tests for the processJob dispatcher.
 *
 * Verifies that each queue name routes to the correct processor
 * and that unknown queues are handled gracefully.
 */

jest.mock('./stt.processor', () => ({ processSttJob: jest.fn() }));
jest.mock('./photo.processor', () => ({ processPhotoJob: jest.fn() }));
jest.mock('./reminders.processor', () => ({ processReminderJob: jest.fn() }));
jest.mock('./coach.processor', () => ({ processCoachMessageJob: jest.fn() }));
jest.mock('./adaptive-target.processor', () => ({ processAdaptiveTargetJob: jest.fn() }));
jest.mock('./meal-timing.processor', () => ({ processMealTimingJob: jest.fn() }));
jest.mock('./coach-memory.processor', () => ({ processCoachMemoryJob: jest.fn() }));

import { processJob } from './index';
import { processSttJob } from './stt.processor';
import { processPhotoJob } from './photo.processor';
import { processReminderJob } from './reminders.processor';
import { processCoachMessageJob } from './coach.processor';
import { processAdaptiveTargetJob } from './adaptive-target.processor';
import { processMealTimingJob } from './meal-timing.processor';
import { processCoachMemoryJob } from './coach-memory.processor';
import { QUEUE_NAMES } from '@coach/shared';
import type { Job } from 'bullmq';

const mockStt = processSttJob as jest.MockedFunction<typeof processSttJob>;
const mockPhoto = processPhotoJob as jest.MockedFunction<typeof processPhotoJob>;
const mockReminder = processReminderJob as jest.MockedFunction<typeof processReminderJob>;
const mockCoach = processCoachMessageJob as jest.MockedFunction<typeof processCoachMessageJob>;
const mockAdaptiveTarget = processAdaptiveTargetJob as jest.MockedFunction<
  typeof processAdaptiveTargetJob
>;
const mockMealTiming = processMealTimingJob as jest.MockedFunction<typeof processMealTimingJob>;
const mockCoachMemory = processCoachMemoryJob as jest.MockedFunction<typeof processCoachMemoryJob>;

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
      mealType: null,
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
      mealName: 'Meal',
      items: [],
      totalCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
      totalFiber: 0,
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

  it('routes coach-messages to processCoachMessageJob', async () => {
    mockCoach.mockResolvedValue(undefined);
    await processJob(QUEUE_NAMES.COACH_MESSAGES, fakeJob);
    expect(mockCoach).toHaveBeenCalledWith(fakeJob);
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

  it('routes adaptive-target to processAdaptiveTargetJob', async () => {
    mockAdaptiveTarget.mockResolvedValue(undefined);
    await processJob(QUEUE_NAMES.ADAPTIVE_TARGET, fakeJob);
    expect(mockAdaptiveTarget).toHaveBeenCalledWith(fakeJob);
    expect(mockStt).not.toHaveBeenCalled();
  });

  it('routes meal-timing-insights to processMealTimingJob', async () => {
    mockMealTiming.mockResolvedValue(undefined);
    await processJob(QUEUE_NAMES.MEAL_TIMING_INSIGHTS, fakeJob);
    expect(mockMealTiming).toHaveBeenCalledWith(fakeJob);
    expect(mockStt).not.toHaveBeenCalled();
  });

  it('routes coach-memory to processCoachMemoryJob', async () => {
    mockCoachMemory.mockResolvedValue(undefined);
    await processJob(QUEUE_NAMES.COACH_MEMORY, fakeJob);
    expect(mockCoachMemory).toHaveBeenCalledWith(fakeJob);
    expect(mockStt).not.toHaveBeenCalled();
  });

  it('warns and returns undefined for unknown queue name', async () => {
    const result = await processJob('unknown-queue' as never, fakeJob);
    expect(result).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('unknown-queue'));
    expect(mockStt).not.toHaveBeenCalled();
  });
});
