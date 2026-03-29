import { Controller, Post, Get, Body, BadRequestException } from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../auth';
import { OnboardingService } from './onboarding.service';
import { completeOnboardingSchema } from './onboarding.dto';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post('complete')
  async completeOnboarding(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const parsed = completeOnboardingSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }

    return { data: await this.onboardingService.completeOnboarding(user.id, parsed.data) };
  }

  @Get('status')
  async getStatus(@CurrentUser() user: AuthenticatedUser) {
    return { data: await this.onboardingService.getOnboardingStatus(user.id) };
  }
}
