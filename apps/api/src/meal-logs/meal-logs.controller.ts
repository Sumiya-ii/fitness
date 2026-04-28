import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../auth';
import { MealLogsService } from './meal-logs.service';
import {
  createMealLogSchema,
  quickAddSchema,
  updateMealLogSchema,
  mealLogQuerySchema,
} from './meal-logs.dto';

@Controller('meal-logs')
export class MealLogsController {
  constructor(private readonly mealLogsService: MealLogsService) {}

  @Post()
  async create(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const parsed = createMealLogSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return { data: await this.mealLogsService.createFromFood(user.id, parsed.data) };
  }

  @Post('quick-add')
  async quickAdd(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const parsed = quickAddSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return { data: await this.mealLogsService.quickAdd(user.id, parsed.data) };
  }

  @Get()
  async findMany(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    const parsed = mealLogQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return this.mealLogsService.findByUser(user.id, parsed.data);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return { data: await this.mealLogsService.findById(user.id, id) };
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = updateMealLogSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return { data: await this.mealLogsService.update(user.id, id, parsed.data) };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.mealLogsService.remove(user.id, id);
  }
}
