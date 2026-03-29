import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../auth';
import { NotificationsService } from './notifications.service';
import { updatePreferencesSchema, registerDeviceTokenSchema } from './notifications.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('preferences')
  async getPreferences(@CurrentUser() user: AuthenticatedUser) {
    return {
      data: await this.notificationsService.getPreferences(user.id),
    };
  }

  @Post('device-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  async registerDeviceToken(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const parsed = registerDeviceTokenSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    await this.notificationsService.registerDeviceToken(user.id, parsed.data);
  }

  @Put('preferences')
  async updatePreferences(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const parsed = updatePreferencesSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return {
      data: await this.notificationsService.updatePreferences(user.id, parsed.data),
    };
  }
}
