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
import { processMealNudgeJob } from './meal-nudge.processor';

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

    case QUEUE_NAMES.MEAL_NUDGE:
      return processMealNudgeJob(job);

    default:
      console.warn(`No processor for queue: ${queueName}`);
  }
}
