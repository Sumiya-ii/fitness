import { Controller, Get } from '@nestjs/common';
import { APP_NAME } from '@coach/shared';
import { Public } from '../auth';
import { QueueHealthService, QueueHealthStatus } from '../queue';

@Controller('health')
export class HealthController {
  constructor(private readonly queueHealth: QueueHealthService) {}

  @Public()
  @Get()
  check() {
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
