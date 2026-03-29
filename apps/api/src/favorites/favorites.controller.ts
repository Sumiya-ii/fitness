import { Controller, Get, Post, Delete, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../auth';
import { FavoritesService } from './favorites.service';

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
    const parsedLimit = limit ? Math.min(parseInt(limit, 10) || 20, 100) : 20;
    return { data: await this.favoritesService.getFavorites(user.id, parsedLimit) };
  }

  @Get('recents')
  async getRecents(@CurrentUser() user: AuthenticatedUser, @Query('limit') limit?: string) {
    const parsedLimit = limit ? Math.min(parseInt(limit, 10) || 20, 100) : 20;
    return { data: await this.favoritesService.getRecents(user.id, parsedLimit) };
  }
}
