import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  BadRequestException,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { FoodsService } from './foods.service';
import {
  createFoodSchema,
  updateFoodSchema,
  foodQuerySchema,
  suggestFoodSchema,
} from './foods.dto';
import { AdminGuard } from '../admin/admin.guard';
import { CurrentUser, AuthenticatedUser } from '../auth';

@Controller('foods')
export class FoodsController {
  constructor(private readonly foodsService: FoodsService) {}

  @Post()
  @UseGuards(AdminGuard)
  async create(@Body() body: unknown) {
    const parsed = createFoodSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return { data: await this.foodsService.create(parsed.data) };
  }

  @Post('suggest')
  async suggest(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const parsed = suggestFoodSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return { data: await this.foodsService.suggest(user.id, parsed.data) };
  }

  @Get()
  async findMany(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    const parsed = foodQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return await this.foodsService.findMany(parsed.data, user.id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return { data: await this.foodsService.findById(id) };
  }

  @Put(':id')
  @UseGuards(AdminGuard)
  async update(@Param('id') id: string, @Body() body: unknown) {
    const parsed = updateFoodSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return { data: await this.foodsService.update(id, parsed.data) };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AdminGuard)
  async remove(@Param('id') id: string) {
    await this.foodsService.remove(id);
  }
}
