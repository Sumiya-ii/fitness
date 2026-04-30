import { Job } from 'bullmq';
import { QueueName, QUEUE_NAMES } from '@coach/shared';
import { logger } from '../logger';
import { processPhotoJob } from './photo.processor';
import { processReminderJob } from './reminders.processor';
import { processCoachMemoryJob } from './coach-memory.processor';
import { processPrivacyJob } from './privacy.processor';

export async function processJob(queueName: QueueName, job: Job): Promise<unknown> {
  switch (queueName) {
    case QUEUE_NAMES.PHOTO_PARSING:
      return processPhotoJob(job);

    case QUEUE_NAMES.REMINDERS:
      return processReminderJob(job);

    case QUEUE_NAMES.COACH_MEMORY:
      return processCoachMemoryJob(job);

    case QUEUE_NAMES.PRIVACY:
      return processPrivacyJob(job);

    default:
      logger.warn({ queueName }, 'No processor registered for queue');
  }
}
