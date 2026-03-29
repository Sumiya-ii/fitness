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
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      status: 'ok',
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
