import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CoachMemoryService } from './coach-memory.service';

@Injectable()
export class CoachMemoryCron {
  constructor(private readonly coachMemoryService: CoachMemoryService) {}

  /**
   * Every Sunday at 02:00 UTC (= 10:00 Asia/Ulaanbaatar).
   * Enqueues one memory-refresh job per user so the worker
   * regenerates GPT summaries over their last 30 days of data.
   */
  @Cron('0 2 * * 0')
  async handleWeeklyMemoryRefresh(): Promise<void> {
    const count = await this.coachMemoryService.scheduleRefresh();
    if (count > 0) {
      console.log(`[CoachMemory] Enqueued memory refresh for ${count} user(s)`);
    }
  }
}
