import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { FavoritesController } from '../../src/favorites/favorites.controller';
import { FavoritesService } from '../../src/favorites/favorites.service';
import { FakeAuthGuard, createTestApp, url, TEST_USER } from './setup';

const FOOD_ID = '00000000-0000-4000-a000-000000000f01';

describe('Favorites (e2e)', () => {
  let app: INestApplication;

  const mockFavorite = { id: 'fav-1', foodId: FOOD_ID, createdAt: '2025-06-15T00:00:00Z' };
  const mockFavoriteList = [
    {
      id: 'fav-1',
      foodId: FOOD_ID,
      name: 'Chicken breast',
      caloriesPer100g: 165,
      servingCount: 2,
      favoritedAt: '2025-06-15T00:00:00Z',
    },
  ];
  const mockRecents = [
    {
      foodId: FOOD_ID,
      name: 'Chicken breast',
      lastCalories: 250,
      lastProtein: 30,
      lastUsedAt: '2025-06-15T12:00:00Z',
    },
  ];

  const mockService = {
    addFavorite: jest.fn().mockResolvedValue(mockFavorite),
    removeFavorite: jest.fn().mockResolvedValue(undefined),
    getFavorites: jest.fn().mockResolvedValue(mockFavoriteList),
    getRecents: jest.fn().mockResolvedValue(mockRecents),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [FavoritesController],
      providers: [
        { provide: FavoritesService, useValue: mockService },
        { provide: APP_GUARD, useClass: FakeAuthGuard },
      ],
    }).compile();
    app = await createTestApp(module);
  });

  afterAll(() => app?.close());
  afterEach(() => jest.clearAllMocks());

  describe('POST /favorites/:foodId', () => {
    it('adds a favorite', () =>
      request(app.getHttpServer())
        .post(url(`favorites/${FOOD_ID}`))
        .expect(201)
        .expect((res) => {
          expect(res.body.data.foodId).toBe(FOOD_ID);
          expect(mockService.addFavorite).toHaveBeenCalledWith(TEST_USER.id, FOOD_ID);
        }));
  });

  describe('DELETE /favorites/:foodId', () => {
    it('removes a favorite', () =>
      request(app.getHttpServer())
        .delete(url(`favorites/${FOOD_ID}`))
        .expect(204)
        .expect(() => {
          expect(mockService.removeFavorite).toHaveBeenCalledWith(TEST_USER.id, FOOD_ID);
        }));
  });

  describe('GET /favorites', () => {
    it('lists favorites with default limit', () =>
      request(app.getHttpServer())
        .get(url('favorites'))
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeInstanceOf(Array);
          expect(res.body.data[0]).toHaveProperty('name');
          expect(mockService.getFavorites).toHaveBeenCalledWith(TEST_USER.id, 20);
        }));

    it('respects limit param', () =>
      request(app.getHttpServer())
        .get(url('favorites?limit=5'))
        .expect(200)
        .expect(() => {
          expect(mockService.getFavorites).toHaveBeenCalledWith(TEST_USER.id, 5);
        }));

    it('caps limit at 100', () =>
      request(app.getHttpServer())
        .get(url('favorites?limit=200'))
        .expect(200)
        .expect(() => {
          expect(mockService.getFavorites).toHaveBeenCalledWith(TEST_USER.id, 100);
        }));
  });

  describe('GET /favorites/recents', () => {
    it('lists recents', () =>
      request(app.getHttpServer())
        .get(url('favorites/recents'))
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeInstanceOf(Array);
          expect(res.body.data[0]).toHaveProperty('lastCalories');
        }));
  });
});
