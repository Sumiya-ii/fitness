import { Controller, Get, Put, Body, BadRequestException } from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../auth';
import { ProfileService } from './profile.service';
import { updateProfileSchema } from './profile.dto';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    return { data: await this.profileService.getProfile(user.id) };
  }

  @Put()
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }

    return { data: await this.profileService.updateProfile(user.id, parsed.data) };
  }
}
