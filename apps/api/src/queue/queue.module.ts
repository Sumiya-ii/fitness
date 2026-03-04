import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '../config';
import { QUEUE_NAMES, DEFAULT_JOB_OPTIONS } from '@coach/shared';
import { QueueHealthService } from './queue-health.service';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.redisUrl,
        },
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      }),
    }),
    ...Object.values(QUEUE_NAMES).map((name) =>
      BullModule.registerQueue({ name }),
    ),
  ],
  providers: [QueueHealthService],
  exports: [BullModule, QueueHealthService],
})
export class QueueModule {}
