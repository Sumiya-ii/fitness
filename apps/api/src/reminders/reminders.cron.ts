import { Cron } from '@nestjs/schedule';
import { Injectable } from '@nestjs/common';
import { RemindersService } from './reminders.service';

@Injectable()
export class RemindersCron {
  constructor(private readonly remindersService: RemindersService) {}

  @Cron('*/15 * * * *') // Every 15 minutes
  async handleMorningReminders() {
    await this.remindersService.scheduleMorningReminders();
  }

  @Cron('*/15 * * * *') // Every 15 minutes
  async handleEveningReminders() {
    await this.remindersService.scheduleEveningReminders();
  }
}
