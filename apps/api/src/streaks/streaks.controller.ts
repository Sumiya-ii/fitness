import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../auth';
import { StreaksService } from './streaks.service';

@Controller('streaks')
export class StreaksController {
  constructor(private readonly streaksService: StreaksService) {}

  @Get()
  async getStreaks(@CurrentUser() user: AuthenticatedUser, @Query('tz') tz?: string) {
    return { data: await this.streaksService.getStreaks(user.id, tz) };
  }
}
