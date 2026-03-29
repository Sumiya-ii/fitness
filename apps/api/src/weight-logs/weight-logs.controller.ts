import { Controller, Get, Post, Body, Query, BadRequestException } from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../auth';
import { WeightLogsService } from './weight-logs.service';
import { createWeightLogSchema } from './weight-logs.dto';

@Controller('weight-logs')
export class WeightLogsController {
  constructor(private readonly weightLogsService: WeightLogsService) {}

  @Post()
  async log(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const parsed = createWeightLogSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return { data: await this.weightLogsService.log(user.id, parsed.data) };
  }

  @Get()
  async getHistory(@CurrentUser() user: AuthenticatedUser, @Query('days') days?: string) {
    const parsedDays = days ? Math.min(parseInt(days, 10) || 30, 365) : 30;
    return { data: await this.weightLogsService.getHistory(user.id, parsedDays) };
  }

  @Get('trend')
  async getTrend(@CurrentUser() user: AuthenticatedUser) {
    return { data: await this.weightLogsService.getTrend(user.id) };
  }
}
