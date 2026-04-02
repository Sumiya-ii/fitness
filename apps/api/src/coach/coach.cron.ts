import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CoachService } from './coach.service';
import { SentryProvider } from '../observability';

@Injectable()
export class CoachCron {
  private readonly logger = new Logger(CoachCron.name);

  constructor(
    private readonly coachService: CoachService,
    private readonly sentry: SentryProvider,
  ) {}

  // Runs at :00, :15, :30, :45 every hour — anchor job; all other 15-min crons are staggered off this
  @Cron('0,15,30,45 * * * *')
  async handleCoachMessages() {
    try {
      const count = await this.coachService.scheduleCoachMessages();
      if (count > 0) {
        this.logger.log(`Enqueued ${count} proactive coach message(s)`);
      }
    } catch (error) {
      this.logger.error('Failed to schedule coach messages', error);
      this.sentry.captureException(error);
    }
  }
}
