import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../auth';
import { AnalyticsService } from './analytics.service';
import { emitEventSchema } from './analytics.dto';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('events')
  async emitEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const parsed = emitEventSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    await this.analyticsService.emit(
      parsed.data.event,
      user.id,
      parsed.data.properties,
      parsed.data.sessionId,
      parsed.data.platform,
    );
    return { ok: true };
  }
}
