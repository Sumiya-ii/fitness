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
import { WorkoutLogsService } from './workout-logs.service';
import {
  createWorkoutLogSchema,
  updateWorkoutLogSchema,
  workoutLogQuerySchema,
} from './workout-logs.dto';

@Controller('workout-logs')
export class WorkoutLogsController {
  constructor(private readonly workoutLogsService: WorkoutLogsService) {}

  @Post()
  async create(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const parsed = createWorkoutLogSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return { data: await this.workoutLogsService.create(user.id, parsed.data) };
  }

  @Get()
  async findMany(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    const parsed = workoutLogQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return this.workoutLogsService.findByUser(user.id, parsed.data);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return { data: await this.workoutLogsService.findById(user.id, id) };
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = updateWorkoutLogSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return { data: await this.workoutLogsService.update(user.id, id, parsed.data) };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.workoutLogsService.remove(user.id, id);
  }
}
