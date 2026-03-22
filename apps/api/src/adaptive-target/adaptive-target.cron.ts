import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AdaptiveTargetService } from './adaptive-target.service';

@Injectable()
export class AdaptiveTargetCron {
  constructor(private readonly adaptiveTargetService: AdaptiveTargetService) {}

  /**
   * Run every Sunday at 01:00 UTC (= 09:00 Asia/Ulaanbaatar).
   * Compares each user's actual weight trend against their goal and adjusts
   * their calorie target accordingly.
   */
  @Cron('0 1 * * 0')
  async handleWeeklyAdjustments(): Promise<void> {
    const count = await this.adaptiveTargetService.runWeeklyAdjustments();
    if (count > 0) {
      console.log(`[AdaptiveTarget] Adjusted calorie targets for ${count} user(s)`);
    }
  }
}
