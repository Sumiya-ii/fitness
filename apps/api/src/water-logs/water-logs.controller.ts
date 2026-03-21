import { Controller, Post, Get, Delete, Body, Query, BadRequestException } from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../auth';
import { WaterLogsService } from './water-logs.service';
import { addWaterSchema } from './water-logs.dto';

@Controller('water-logs')
export class WaterLogsController {
  constructor(private readonly waterLogsService: WaterLogsService) {}

  @Post()
  async add(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const parsed = addWaterSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return { data: await this.waterLogsService.add(user.id, parsed.data) };
  }

  @Get()
  async getDaily(@CurrentUser() user: AuthenticatedUser, @Query('date') date?: string) {
    return { data: await this.waterLogsService.getDaily(user.id, date) };
  }

  @Delete('last')
  async deleteLast(@CurrentUser() user: AuthenticatedUser) {
    return { data: await this.waterLogsService.deleteLast(user.id) };
  }
}
