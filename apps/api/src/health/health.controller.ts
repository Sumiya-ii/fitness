import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { APP_NAME } from '@coach/shared';
import { Public } from '../auth';
import { SkipThrottle } from '@nestjs/throttler';
import { QueueHealthService, QueueHealthStatus } from '../queue';
import { PrismaService } from '../prisma';
import { ConfigService } from '../config';
import { Response } from 'express';
import Redis from 'ioredis';

@SkipThrottle()
@Controller('health')
export class HealthController {
  private readonly redis: Redis;

  constructor(
    private readonly queueHealth: QueueHealthService,
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.redis = new Redis(config.redisUrl, { lazyConnect: true, enableOfflineQueue: false });
  }

  @Public()
  @Get()
  async check(@Res() res: Response) {
    let dbOk = false;
    let redisOk = false;

    await Promise.all([
      this.prisma.$queryRaw`SELECT 1`
        .then(() => {
          dbOk = true;
        })
        .catch(() => {}),
      this.redis
        .ping()
        .then((reply) => {
          redisOk = reply === 'PONG';
        })
        .catch(() => {}),
    ]);

    const allOk = dbOk && redisOk;
    const body = {
      status: allOk ? 'ok' : 'degraded',
      app: APP_NAME,
      timestamp: new Date().toISOString(),
      services: {
        database: dbOk ? 'up' : 'down',
        redis: redisOk ? 'up' : 'down',
      },
    };

    return res.status(allOk ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).json(body);
  }

  @Get('queues')
  async checkQueues(): Promise<{ queues: QueueHealthStatus[] }> {
    const queues = await this.queueHealth.getHealth();
    return { queues };
  }
}
