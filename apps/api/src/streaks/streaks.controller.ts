import { Controller, Get, Query, Headers } from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../auth';
import { StreaksService } from './streaks.service';

@Controller('streaks')
export class StreaksController {
  constructor(private readonly streaksService: StreaksService) {}

  @Get()
  async getStreaks(
    @CurrentUser() user: AuthenticatedUser,
    @Query('tz') tz?: string,
    @Headers('time-zone') tzHeader?: string,
  ) {
    // ?tz wins over the Time-Zone header; both are optional since the service
    // falls back to the user's stored profiles.timezone → Asia/Ulaanbaatar.
    return { data: await this.streaksService.getStreaks(user.id, tz ?? tzHeader) };
  }
}
