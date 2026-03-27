import { Inject, Injectable } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '@coach/shared';

export interface QueueHealthStatus {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

@Injectable()
export class QueueHealthService {
  private readonly queues: Queue[];

  constructor(
    @Inject(getQueueToken(QUEUE_NAMES.STT_PROCESSING)) sttQueue: Queue,
    @Inject(getQueueToken(QUEUE_NAMES.PHOTO_PARSING)) photoQueue: Queue,
    @Inject(getQueueToken(QUEUE_NAMES.REMINDERS)) reminderQueue: Queue,
  ) {
    this.queues = [sttQueue, photoQueue, reminderQueue];
  }

  async getHealth(): Promise<QueueHealthStatus[]> {
    return Promise.all(
      this.queues.map(async (queue) => {
        const [waiting, active, completed, failed, delayed, isPaused] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getCompletedCount(),
          queue.getFailedCount(),
          queue.getDelayedCount(),
          queue.isPaused(),
        ]);

        return {
          name: queue.name,
          waiting,
          active,
          completed,
          failed,
          delayed,
          paused: isPaused,
        };
      }),
    );
  }
}
