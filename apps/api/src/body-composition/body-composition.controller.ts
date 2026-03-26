import { Controller, Get, Post, Body, Query, BadRequestException } from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../auth';
import { BodyCompositionService } from './body-composition.service';
import { logMeasurementSchema } from './body-composition.dto';

@Controller('body-composition')
export class BodyCompositionController {
  constructor(private readonly bodyCompositionService: BodyCompositionService) {}

  @Post('measurements')
  async logMeasurement(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const parsed = logMeasurementSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return { data: await this.bodyCompositionService.logMeasurement(user.id, parsed.data) };
  }

  @Get()
  async getLatest(@CurrentUser() user: AuthenticatedUser) {
    return { data: await this.bodyCompositionService.getLatest(user.id) };
  }

  @Get('history')
  async getHistory(@CurrentUser() user: AuthenticatedUser, @Query('days') days?: string) {
    const parsedDays = days ? Math.min(parseInt(days, 10) || 90, 365) : 90;
    return { data: await this.bodyCompositionService.getHistory(user.id, parsedDays) };
  }

  @Get('weekly-budget')
  async getWeeklyBudget(@CurrentUser() user: AuthenticatedUser) {
    return { data: await this.bodyCompositionService.getWeeklyBudget(user.id) };
  }
}
