import { Controller, Get, Post, Body, BadRequestException } from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../auth';
import { TargetsService } from './targets.service';
import { createTargetSchema } from './targets.dto';

@Controller('targets')
export class TargetsController {
  constructor(private readonly targetsService: TargetsService) {}

  @Post()
  async createTarget(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const parsed = createTargetSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }

    return { data: await this.targetsService.createTarget(user.id, parsed.data) };
  }

  @Get('current')
  async getCurrentTarget(@CurrentUser() user: AuthenticatedUser) {
    const target = await this.targetsService.getCurrentTarget(user.id);
    return { data: target };
  }

  @Get('history')
  async getTargetHistory(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.targetsService.getTargetHistory(user.id);
    return { data };
  }
}
