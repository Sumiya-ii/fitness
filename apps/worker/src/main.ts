import 'dotenv/config';
import * as Sentry from '@sentry/node';
import { APP_NAME, QUEUE_NAMES, DEFAULT_JOB_OPTIONS, validateEnv } from '@coach/shared';
import { createWorkerForQueue } from './worker-factory';
import { logger } from './logger';

async function bootstrap() {
  const config = validateEnv();

  // Initialize Sentry before anything else so all errors are captured
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV ?? 'production',
      tracesSampleRate: 0.1,
    });
    logger.info('Sentry initialized');
  } else {
    logger.warn('SENTRY_DSN not set — error reporting disabled');
  }

  const queueNames = Object.values(QUEUE_NAMES);
  const workers = queueNames.map((queueName) => createWorkerForQueue(queueName, config.REDIS_URL));

  logger.info(
    {
      queues: queueNames,
      retryPolicy: { attempts: DEFAULT_JOB_OPTIONS.attempts, backoff: 'exponential' },
    },
    `${APP_NAME} Worker started with ${workers.length} workers`,
  );

  const shutdown = async () => {
    logger.info('Shutting down workers...');
    await Sentry.flush(2000);
    await Promise.all(workers.map((w) => w.close()));
    logger.info('All workers stopped');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap();
