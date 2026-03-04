import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { RemindersService } from './reminders.service';
import { RemindersCron } from './reminders.cron';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [RemindersService, RemindersCron],
  exports: [RemindersService],
})
export class RemindersModule {}
