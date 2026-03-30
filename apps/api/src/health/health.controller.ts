import { Controller, Get } from '@nestjs/common';
import { APP_NAME } from '@coach/shared';
import { Public } from '../auth';
import { SkipThrottle } from '@nestjs/throttler';
import { QueueHealthService, QueueHealthStatus } from '../queue';
import { PrismaService } from '../prisma';

@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly queueHealth: QueueHealthService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get()
  async check() {
    let dbOk = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch {
      // DB temporarily unreachable — return 200 so Railway keeps the process alive.
      // A degraded status is better than a crash loop; the DB usually recovers on its own.
    }
    return {
      status: dbOk ? 'ok' : 'degraded',
      app: APP_NAME,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('queues')
  async checkQueues(): Promise<{ queues: QueueHealthStatus[] }> {
    const queues = await this.queueHealth.getHealth();
    return { queues };
  }
}
