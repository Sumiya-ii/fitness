import { Controller, Get, Put, Body, BadRequestException } from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../auth';
import { NotificationsService } from './notifications.service';
import { updatePreferencesSchema } from './notifications.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('preferences')
  async getPreferences(@CurrentUser() user: AuthenticatedUser) {
    return {
      data: await this.notificationsService.getPreferences(user.id),
    };
  }

  @Put('preferences')
  async updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const parsed = updatePreferencesSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return {
      data: await this.notificationsService.updatePreferences(user.id, parsed.data),
    };
  }
}
