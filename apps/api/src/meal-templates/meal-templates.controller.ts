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
import { MealTemplatesService } from './meal-templates.service';
import {
  createTemplateSchema,
  createFromLogSchema,
  updateTemplateSchema,
  logTemplateSchema,
  templateQuerySchema,
} from './meal-templates.dto';

@Controller('meal-templates')
export class MealTemplatesController {
  constructor(private readonly service: MealTemplatesService) {}

  @Post()
  async create(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const parsed = createTemplateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return { data: await this.service.create(user.id, parsed.data) };
  }

  @Post('from-log/:mealLogId')
  async createFromLog(
    @CurrentUser() user: AuthenticatedUser,
    @Param('mealLogId') mealLogId: string,
    @Body() body: unknown,
  ) {
    const parsed = createFromLogSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return { data: await this.service.createFromLog(user.id, mealLogId, parsed.data) };
  }

  @Get()
  async findMany(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    const parsed = templateQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return this.service.findByUser(user.id, parsed.data);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return { data: await this.service.findById(user.id, id) };
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = updateTemplateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return { data: await this.service.update(user.id, id, parsed.data) };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.service.remove(user.id, id);
  }

  @Post(':id/log')
  async logTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = logTemplateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return { data: await this.service.logTemplate(user.id, id, parsed.data) };
  }
}
