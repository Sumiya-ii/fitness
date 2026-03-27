import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { API_PREFIX, QUEUE_NAMES } from '@coach/shared';
import { ConfigService } from './config';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter as BullBoardExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';
import { Request, Response, NextFunction } from 'express';

const BULL_BOARD_PATH = '/admin/queues';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix(API_PREFIX);
  app.enableCors();

  const config = app.get(ConfigService);
  const port = config.port;

  // ── Bull Board ────────────────────────────────────────────────────────────
  // Mount directly on the underlying Express app so NestJS's global prefix
  // and routing layer don't interfere.
  const boardAdapter = new BullBoardExpressAdapter();
  boardAdapter.setBasePath(BULL_BOARD_PATH);

  createBullBoard({
    queues: Object.values(QUEUE_NAMES).map(
      (name) => new BullMQAdapter(new Queue(name, { connection: { url: config.redisUrl } })),
    ),
    serverAdapter: boardAdapter,
  });

  const basicAuth = (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Coach Admin"');
      res.status(401).send('Authentication required');
      return;
    }
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf-8');
    const colonIdx = decoded.indexOf(':');
    const user = decoded.slice(0, colonIdx);
    const pass = decoded.slice(colonIdx + 1);
    if (user !== config.bullBoardUser || pass !== config.bullBoardPassword) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Coach Admin"');
      res.status(401).send('Invalid credentials');
      return;
    }
    next();
  };

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use(BULL_BOARD_PATH, basicAuth, boardAdapter.getRouter());
  // ─────────────────────────────────────────────────────────────────────────

  if (!config.isProduction) {
    const documentBuilder = new DocumentBuilder()
      .setTitle('Coach API')
      .setDescription('AI nutrition coaching app backend')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, documentBuilder);
    SwaggerModule.setup('api/docs', app, document);
  }

  // ── Graceful shutdown: flush Sentry before exit ──────────────────────────
  const sentry = app.get((await import('./observability/sentry.provider')).SentryProvider);

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down gracefully...`);
    await sentry.close(2000);
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    if (sentry.isAvailable) {
      sentry.captureException(error);
    }
    sentry.close(2000).finally(() => process.exit(1));
  });

  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
    if (sentry.isAvailable) {
      sentry.captureException(reason);
    }
  });

  await app.listen(port);
  console.log(`Coach API running on port ${port}`);
  console.log(`Bull Board available at ${BULL_BOARD_PATH}`);
}
bootstrap().catch((error) => {
  console.error('Failed to bootstrap application:', error);
  process.exit(1);
});
