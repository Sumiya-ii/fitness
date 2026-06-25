import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser, AuthenticatedUser } from '../auth';
import { FavoritesService } from './favorites.service';

const limitSchema = z.coerce.number().int().min(1).max(100).default(20);

@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Post(':foodId')
  async addFavorite(@CurrentUser() user: AuthenticatedUser, @Param('foodId') foodId: string) {
    return { data: await this.favoritesService.addFavorite(user.id, foodId) };
  }

  @Delete(':foodId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeFavorite(@CurrentUser() user: AuthenticatedUser, @Param('foodId') foodId: string) {
    await this.favoritesService.removeFavorite(user.id, foodId);
  }

  @Get()
  async getFavorites(@CurrentUser() user: AuthenticatedUser, @Query('limit') limit?: string) {
    const parsed = limitSchema.safeParse(limit);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return { data: await this.favoritesService.getFavorites(user.id, parsed.data) };
  }

  @Get('recents')
  async getRecents(@CurrentUser() user: AuthenticatedUser, @Query('limit') limit?: string) {
    const parsed = limitSchema.safeParse(limit);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return { data: await this.favoritesService.getRecents(user.id, parsed.data) };
  }
}
