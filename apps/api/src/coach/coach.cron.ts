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

  @Cron('*/15 * * * *')
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
