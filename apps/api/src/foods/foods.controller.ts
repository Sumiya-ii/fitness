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
} from '@nestjs/common';
import { FoodsService } from './foods.service';
import { createFoodSchema, updateFoodSchema, foodQuerySchema } from './foods.dto';

@Controller('foods')
export class FoodsController {
  constructor(private readonly foodsService: FoodsService) {}

  @Post()
  async create(@Body() body: unknown) {
    const parsed = createFoodSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return { data: await this.foodsService.create(parsed.data) };
  }

  @Get()
  async findMany(@Query() query: unknown) {
    const parsed = foodQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return await this.foodsService.findMany(parsed.data);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return { data: await this.foodsService.findById(id) };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: unknown) {
    const parsed = updateFoodSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return { data: await this.foodsService.update(id, parsed.data) };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.foodsService.remove(id);
  }
}
