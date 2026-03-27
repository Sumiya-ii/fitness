import { Cron } from '@nestjs/schedule';
import { Injectable, Logger } from '@nestjs/common';
import { RemindersService } from './reminders.service';
import { SentryProvider } from '../observability';

@Injectable()
export class RemindersCron {
  private readonly logger = new Logger(RemindersCron.name);

  constructor(
    private readonly remindersService: RemindersService,
    private readonly sentry: SentryProvider,
  ) {}

  @Cron('*/15 * * * *') // Every 15 minutes
  async handleMorningReminders() {
    try {
      await this.remindersService.scheduleMorningReminders();
    } catch (error) {
      this.logger.error('Failed to schedule morning reminders', error);
      this.sentry.captureException(error);
    }
  }

  @Cron('*/15 * * * *') // Every 15 minutes
  async handleEveningReminders() {
    try {
      await this.remindersService.scheduleEveningReminders();
    } catch (error) {
      this.logger.error('Failed to schedule evening reminders', error);
      this.sentry.captureException(error);
    }
  }
}
