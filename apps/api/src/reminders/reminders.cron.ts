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

  // Runs at :05, :20, :35, :50 every hour (staggered 5 min from coach at :00)
  @Cron('5,20,35,50 * * * *')
  async handleMorningReminders() {
    try {
      await this.remindersService.scheduleMorningReminders();
    } catch (error) {
      this.logger.error('Failed to schedule morning reminders', error);
      this.sentry.captureException(error);
    }
  }

  // Runs at :10, :25, :40, :55 every hour (staggered 10 min from coach at :00)
  @Cron('10,25,40,55 * * * *')
  async handleEveningReminders() {
    try {
      await this.remindersService.scheduleEveningReminders();
    } catch (error) {
      this.logger.error('Failed to schedule evening reminders', error);
      this.sentry.captureException(error);
    }
  }
}
