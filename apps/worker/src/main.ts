import 'dotenv/config';
import * as Sentry from '@sentry/node';
import { APP_NAME, QUEUE_NAMES, DEFAULT_JOB_OPTIONS, validateEnv } from '@coach/shared';
import { createWorkerForQueue } from './worker-factory';

async function bootstrap() {
  const config = validateEnv();

  // Initialize Sentry before anything else so all errors are captured
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV ?? 'production',
      tracesSampleRate: 0.1,
    });
    console.log('[Sentry] Initialized');
  } else {
    console.warn('[Sentry] SENTRY_DSN not set — error reporting disabled');
  }

  console.log(`${APP_NAME} Worker starting...`);

  const workers = Object.values(QUEUE_NAMES).map((queueName) =>
    createWorkerForQueue(queueName, config.REDIS_URL),
  );

  console.log(`Started ${workers.length} workers:`, Object.values(QUEUE_NAMES).join(', '));
  console.log(
    `Default retry policy: ${DEFAULT_JOB_OPTIONS.attempts} attempts, exponential backoff`,
  );

  const shutdown = async () => {
    console.log('Shutting down workers...');
    await Sentry.flush(2000);
    await Promise.all(workers.map((w) => w.close()));
    console.log('All workers stopped.');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap();
