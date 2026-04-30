import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../auth';
import { AdminService } from './admin.service';
import {
  moderationQuerySchema,
  rejectSchema,
  approveFoodSuggestionSchema,
  messageQuerySchema,
  messageStatsQuerySchema,
} from './admin.dto';
import { AdminGuard } from './admin.guard';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('moderation')
  async listModeration(@CurrentUser() _user: AuthenticatedUser, @Query() query: unknown) {
    const parsed = moderationQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return this.adminService.listModerationQueue(parsed.data);
  }

  @Post('moderation/:id/approve')
  async approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    // body is optional — only required for food_suggestion kind
    const parsed =
      body && Object.keys(body as object).length > 0
        ? approveFoodSuggestionSchema.safeParse(body)
        : { success: true as const, data: undefined };
    if (!parsed.success) {
      throw new BadRequestException(
        (parsed as { success: false; error: { issues: unknown } }).error.issues,
      );
    }
    return this.adminService.approve(user.id, id, parsed.data);
  }

  @Post('moderation/:id/reject')
  async reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = rejectSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return this.adminService.reject(user.id, id, parsed.data);
  }

  // ── Outbound message log ───────────────────────────────────────

  @Get('messages')
  async listMessages(@CurrentUser() _user: AuthenticatedUser, @Query() query: unknown) {
    const parsed = messageQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return this.adminService.listMessages(parsed.data);
  }

  @Get('messages/stats')
  async messageStats(@CurrentUser() _user: AuthenticatedUser, @Query() query: unknown) {
    const parsed = messageStatsQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return this.adminService.getMessageStats(parsed.data);
  }
}
