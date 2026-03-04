import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../auth';
import { PrivacyService } from './privacy.service';
import {
  createConsentSchema,
  paginationSchema,
} from './privacy.dto';

@Controller('privacy')
export class PrivacyController {
  constructor(private readonly privacyService: PrivacyService) {}

  @Post('consent')
  async createConsent(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const parsed = createConsentSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return {
      data: await this.privacyService.createConsent(user.id, parsed.data),
    };
  }

  @Post('export')
  async requestExport(@CurrentUser() user: AuthenticatedUser) {
    return {
      data: await this.privacyService.requestDataExport(user.id),
    };
  }

  @Post('delete-account')
  async requestDeleteAccount(@CurrentUser() user: AuthenticatedUser) {
    return {
      data: await this.privacyService.requestAccountDeletion(user.id),
    };
  }

  @Get('requests')
  async getRequests(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: unknown,
  ) {
    const parsed = paginationSchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return this.privacyService.getRequests(user.id, parsed.data);
  }
}
