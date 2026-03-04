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
      await processJob(queueName, job);
      console.log(`[${queueName}] Completed job ${job.id}`);
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
      return 2; // AI workloads - limit concurrency
    case QUEUE_NAMES.ANALYTICS:
      return 10; // High-throughput, low-cost
    default:
      return 5;
  }
}
