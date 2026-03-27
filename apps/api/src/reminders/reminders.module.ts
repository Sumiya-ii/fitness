import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { RemindersService } from './reminders.service';
import { RemindersCron } from './reminders.cron';
import { ObservabilityModule } from '../observability';

@Module({
  imports: [ScheduleModule.forRoot(), ObservabilityModule],
  providers: [RemindersService, RemindersCron],
  exports: [RemindersService],
})
export class RemindersModule {}
