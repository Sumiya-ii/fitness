import { Worker, Job } from 'bullmq';
import * as Sentry from '@sentry/node';
import { QUEUE_NAMES, QueueName } from '@coach/shared';
import { processJob } from './processors';
import { logger } from './logger';

export function createWorkerForQueue(queueName: QueueName, redisUrl: string): Worker {
  const queueLogger = logger.child({ queue: queueName });

  const worker = new Worker(
    queueName,
    async (job: Job) => {
      queueLogger.info(
        { jobId: job.id, jobName: job.name },
        `Processing job ${job.id}: ${job.name}`,
      );
      const result = await processJob(queueName, job);
      queueLogger.info({ jobId: job.id, jobName: job.name }, `Completed job ${job.id}`);
      return result;
    },
    {
      connection: { url: redisUrl },
      concurrency: getConcurrency(queueName),
    },
  );

  worker.on('failed', (job, err) => {
    const isFinalAttempt =
      job?.attemptsMade !== undefined &&
      job?.opts?.attempts !== undefined &&
      job.attemptsMade >= job.opts.attempts;

    queueLogger.error(
      {
        jobId: job?.id,
        jobName: job?.name,
        attempt: job?.attemptsMade,
        maxAttempts: job?.opts?.attempts,
        isFinalAttempt,
        error: err.message,
      },
      `Job ${job?.id} failed (attempt ${job?.attemptsMade}): ${err.message}`,
    );

    // Only report to Sentry on the final attempt to avoid duplicate noise
    if (isFinalAttempt) {
      Sentry.withScope((scope) => {
        scope.setTag('queue', queueName);
        scope.setTag('job_name', job?.name ?? 'unknown');
        scope.setContext('job', {
          id: job?.id,
          name: job?.name,
          attemptsMade: job?.attemptsMade,
          data: job?.data,
        });
        Sentry.captureException(err);
      });
    }
  });

  worker.on('error', (err) => {
    queueLogger.error({ error: err.message, stack: err.stack }, `Worker error: ${err.message}`);
    Sentry.captureException(err, { tags: { queue: queueName } });
  });

  return worker;
}

function getConcurrency(queueName: QueueName): number {
  switch (queueName) {
    case QUEUE_NAMES.PHOTO_PARSING:
      return 2;
    case QUEUE_NAMES.PRIVACY:
      // Sequential for safety — export/deletion jobs are heavy and must not interleave
      return 1;
    default:
      return 5;
  }
}
