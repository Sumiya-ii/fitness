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
  estimateQuerySchema,
} from './workout-logs.dto';

@Controller('workout-logs')
export class WorkoutLogsController {
  constructor(private readonly workoutLogsService: WorkoutLogsService) {}

  /** Categorized workout type catalog for the mobile picker (no auth needed). */
  @Get('types')
  getTypes() {
    return { data: this.workoutLogsService.getTypes() };
  }

  /** Flat list of all workout types (for search/autocomplete). */
  @Get('types/list')
  getTypeList() {
    return { data: this.workoutLogsService.getTypeList() };
  }

  /** Calorie burn preview: ?workoutType=running&durationMin=30 */
  @Get('estimate')
  async estimate(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    const parsed = estimateQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return {
      data: await this.workoutLogsService.estimate(
        user.id,
        parsed.data.workoutType,
        parsed.data.durationMin,
      ),
    };
  }

  /** Last 5 distinct workout types the user has logged. */
  @Get('recents')
  async getRecents(@CurrentUser() user: AuthenticatedUser) {
    return { data: await this.workoutLogsService.getRecents(user.id) };
  }

  /** This week's workout summary. */
  @Get('summary')
  async getSummary(@CurrentUser() user: AuthenticatedUser) {
    return { data: await this.workoutLogsService.getWeeklySummary(user.id) };
  }

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
