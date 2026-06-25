import { Controller, Get, Post, Body, Query, BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser, AuthenticatedUser } from '../auth';
import { WeightLogsService } from './weight-logs.service';
import { createWeightLogSchema } from './weight-logs.dto';

const trendQuerySchema = z.object({
  window: z.coerce.number().int().min(1).max(30).default(7),
});

const historyQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

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
  async getHistory(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    const parsed = historyQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return { data: await this.weightLogsService.getHistory(user.id, parsed.data.days) };
  }

  @Get('trend')
  async getTrend(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    const parsed = trendQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    // Returns the summary (current + rolling weekly average + delta) together with
    // the smoothed `points` series, so the mobile store and chart read one shape.
    return { data: await this.weightLogsService.getTrend(user.id, parsed.data.window) };
  }
}
