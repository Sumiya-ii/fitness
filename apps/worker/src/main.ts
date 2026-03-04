import 'dotenv/config';
import { APP_NAME, QUEUE_NAMES, DEFAULT_JOB_OPTIONS, validateEnv } from '@coach/shared';
import { createWorkerForQueue } from './worker-factory';

async function bootstrap() {
  const config = validateEnv();
  console.log(`${APP_NAME} Worker starting...`);

  const workers = Object.values(QUEUE_NAMES).map((queueName) =>
    createWorkerForQueue(queueName, config.REDIS_URL),
  );

  console.log(
    `Started ${workers.length} workers:`,
    Object.values(QUEUE_NAMES).join(', '),
  );
  console.log(
    `Default retry policy: ${DEFAULT_JOB_OPTIONS.attempts} attempts, exponential backoff`,
  );

  const shutdown = async () => {
    console.log('Shutting down workers...');
    await Promise.all(workers.map((w) => w.close()));
    console.log('All workers stopped.');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap();
