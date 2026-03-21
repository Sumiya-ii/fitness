import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CoachService } from './coach.service';

@Injectable()
export class CoachCron {
  constructor(private readonly coachService: CoachService) {}

  @Cron('*/15 * * * *')
  async handleCoachMessages() {
    const count = await this.coachService.scheduleCoachMessages();
    if (count > 0) {
      console.log(`[CoachCron] Enqueued ${count} proactive coach message(s)`);
    }
  }
}
