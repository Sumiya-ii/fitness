import { Worker, Job } from 'bullmq';
import { QUEUE_NAMES, QueueName } from '@coach/shared';
import { processJob } from './processors';

export function createWorkerForQueue(
  queueName: QueueName,
  redisUrl: string,
): Worker {
  const worker = new Worker(
    queueName,
    async (job: Job) => {
      console.log(`[${queueName}] Processing job ${job.id}: ${job.name}`);
      const result = await processJob(queueName, job);
      console.log(`[${queueName}] Completed job ${job.id}`);
      return result;
    },
    {
      connection: { url: redisUrl },
      concurrency: getConcurrency(queueName),
    },
  );

  worker.on('failed', (job, err) => {
    console.error(
      `[${queueName}] Job ${job?.id} failed (attempt ${job?.attemptsMade}):`,
      err.message,
    );
  });

  worker.on('error', (err) => {
    console.error(`[${queueName}] Worker error:`, err.message);
  });

  return worker;
}

function getConcurrency(queueName: QueueName): number {
  switch (queueName) {
    case QUEUE_NAMES.STT_PROCESSING:
    case QUEUE_NAMES.PHOTO_PARSING:
      return 2;
    case QUEUE_NAMES.ANALYTICS:
      return 10;
    default:
      return 5;
  }
}
