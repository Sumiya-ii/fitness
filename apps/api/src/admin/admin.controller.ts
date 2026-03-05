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
import { moderationQuerySchema, rejectSchema } from './admin.dto';
import { AdminGuard } from './admin.guard';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('moderation')
  async listModeration(
    @CurrentUser() _user: AuthenticatedUser,
    @Query() query: unknown,
  ) {
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
  ) {
    return this.adminService.approve(user.id, id);
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
}
