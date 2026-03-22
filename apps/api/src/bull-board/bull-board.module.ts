import { Module } from '@nestjs/common';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { QUEUE_NAMES } from '@coach/shared';

@Module({
  imports: [
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),
    ...Object.values(QUEUE_NAMES).map((name) =>
      BullBoardModule.forFeature({
        name,
        adapter: BullMQAdapter,
      }),
    ),
  ],
})
export class BullBoardUiModule {}
