import {
  Controller,
  Get,
  Delete,
  Param,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma';
import { CurrentUser, AuthenticatedUser } from '../auth';

@Controller('coach-memories')
export class CoachMemoryController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    const memories = await this.prisma.coachMemory.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
    });
    return {
      data: memories.map((m) => ({
        id: m.id,
        category: m.category,
        summary: m.summary,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
      })),
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const memory = await this.prisma.coachMemory.findFirst({
      where: { id, userId: user.id },
    });
    if (!memory) {
      throw new NotFoundException('Memory not found');
    }
    await this.prisma.coachMemory.delete({ where: { id } });
  }
}
