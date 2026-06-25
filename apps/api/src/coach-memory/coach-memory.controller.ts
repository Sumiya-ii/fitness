import { Controller, Get, Delete, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../auth';
import { CoachMemoryService } from './coach-memory.service';

@Controller('coach-memories')
export class CoachMemoryController {
  constructor(private readonly coachMemoryService: CoachMemoryService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    return { data: await this.coachMemoryService.listMemories(user.id) };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.coachMemoryService.removeMemory(user.id, id);
  }
}
