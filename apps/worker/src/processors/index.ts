import { Job } from 'bullmq';
import { QueueName, QUEUE_NAMES } from '@coach/shared';
import { processSttJob } from './stt.processor';
import { processPhotoJob } from './photo.processor';
import { processReminderJob } from './reminders.processor';
import { processCoachMessageJob } from './coach.processor';
import { processWeeklyReportJob } from './weekly-report.processor';
import { processAdaptiveTargetJob } from './adaptive-target.processor';
import { processMealTimingJob } from './meal-timing.processor';
import { processCoachMemoryJob } from './coach-memory.processor';

export async function processJob(queueName: QueueName, job: Job): Promise<unknown> {
  switch (queueName) {
    case QUEUE_NAMES.STT_PROCESSING:
      return processSttJob(job);

    case QUEUE_NAMES.PHOTO_PARSING:
      return processPhotoJob(job);

    case QUEUE_NAMES.REMINDERS:
      return processReminderJob(job);

    case QUEUE_NAMES.COACH_MESSAGES:
      return processCoachMessageJob(job);

    case QUEUE_NAMES.WEEKLY_REPORT:
      return processWeeklyReportJob(job);

    case QUEUE_NAMES.ADAPTIVE_TARGET:
      return processAdaptiveTargetJob(job);

    case QUEUE_NAMES.MEAL_TIMING_INSIGHTS:
      return processMealTimingJob(job);

    case QUEUE_NAMES.COACH_MEMORY:
      return processCoachMemoryJob(job);

    case QUEUE_NAMES.FOOD_INDEX_SYNC:
      // TODO: Call Typesense reindex when Typesense is configured
      console.log(`[FoodIndex] Would sync: ${job.name} (${job.id})`);
      return;

    case QUEUE_NAMES.DATA_EXPORT:
      // TODO: Generate JSON/CSV export, upload to S3, notify user
      console.log(`[DataExport] Would process: ${job.name} (${job.id})`);
      return;

    case QUEUE_NAMES.WEBHOOK_RETRY:
      // TODO: Retry failed webhook deliveries
      console.log(`[Webhook] Would retry: ${job.name} (${job.id})`);
      return;

    case QUEUE_NAMES.ANALYTICS:
      // TODO: Forward to PostHog or analytics pipeline
      console.log(`[Analytics] Would process: ${job.name} (${job.id})`);
      return;

    default:
      console.warn(`No processor for queue: ${queueName}`);
  }
}
