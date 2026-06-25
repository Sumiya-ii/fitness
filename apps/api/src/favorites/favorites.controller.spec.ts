import { BadRequestException } from '@nestjs/common';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';
import type { AuthenticatedUser } from '../auth';

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  firebaseUid: 'firebase-uid-1',
  email: null,
  phone: null,
};

const mockService = {
  addFavorite: jest.fn(),
  removeFavorite: jest.fn(),
  getFavorites: jest.fn(),
  getRecents: jest.fn(),
};

describe('FavoritesController', () => {
  let controller: FavoritesController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new FavoritesController(mockService as unknown as FavoritesService);
  });

  describe('addFavorite', () => {
    it('should return wrapped result', async () => {
      const result = { id: 'fav-1', foodId: 'food-1', createdAt: '2026-01-01T00:00:00.000Z' };
      mockService.addFavorite.mockResolvedValue(result);

      const response = await controller.addFavorite(mockUser, 'food-1');

      expect(response).toEqual({ data: result });
      expect(mockService.addFavorite).toHaveBeenCalledWith('user-1', 'food-1');
    });
  });

  describe('removeFavorite', () => {
    it('should call service and return nothing', async () => {
      mockService.removeFavorite.mockResolvedValue(undefined);

      await controller.removeFavorite(mockUser, 'food-1');

      expect(mockService.removeFavorite).toHaveBeenCalledWith('user-1', 'food-1');
    });
  });

  describe('getFavorites', () => {
    it('should use default limit of 20 when no limit provided', async () => {
      mockService.getFavorites.mockResolvedValue([]);

      await controller.getFavorites(mockUser, undefined);

      expect(mockService.getFavorites).toHaveBeenCalledWith('user-1', 20);
    });

    it('should use provided valid limit', async () => {
      mockService.getFavorites.mockResolvedValue([]);

      await controller.getFavorites(mockUser, '50');

      expect(mockService.getFavorites).toHaveBeenCalledWith('user-1', 50);
    });

    it('should reject limit of 0', async () => {
      await expect(controller.getFavorites(mockUser, '0')).rejects.toThrow(BadRequestException);
    });

    it('should reject negative limit', async () => {
      await expect(controller.getFavorites(mockUser, '-1')).rejects.toThrow(BadRequestException);
    });

    it('should reject limit exceeding max (100)', async () => {
      await expect(controller.getFavorites(mockUser, '101')).rejects.toThrow(BadRequestException);
    });

    it('should reject non-integer limit', async () => {
      await expect(controller.getFavorites(mockUser, 'abc')).rejects.toThrow(BadRequestException);
    });

    it('should return wrapped result', async () => {
      const items = [{ foodId: 'food-1', name: 'Apple' }];
      mockService.getFavorites.mockResolvedValue(items);

      const response = await controller.getFavorites(mockUser, '10');

      expect(response).toEqual({ data: items });
    });
  });

  describe('getRecents', () => {
    it('should use default limit of 20 when no limit provided', async () => {
      mockService.getRecents.mockResolvedValue([]);

      await controller.getRecents(mockUser, undefined);

      expect(mockService.getRecents).toHaveBeenCalledWith('user-1', 20);
    });

    it('should use provided valid limit', async () => {
      mockService.getRecents.mockResolvedValue([]);

      await controller.getRecents(mockUser, '5');

      expect(mockService.getRecents).toHaveBeenCalledWith('user-1', 5);
    });

    it('should reject limit of -1', async () => {
      await expect(controller.getRecents(mockUser, '-1')).rejects.toThrow(BadRequestException);
    });

    it('should reject limit exceeding max (100)', async () => {
      await expect(controller.getRecents(mockUser, '200')).rejects.toThrow(BadRequestException);
    });

    it('should return wrapped result', async () => {
      const items = [{ foodId: 'food-1', name: 'Rice' }];
      mockService.getRecents.mockResolvedValue(items);

      const response = await controller.getRecents(mockUser, '3');

      expect(response).toEqual({ data: items });
    });
  });
});
