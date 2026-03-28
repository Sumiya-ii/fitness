import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { MealLogsController } from '../../src/meal-logs/meal-logs.controller';
import { MealLogsService } from '../../src/meal-logs/meal-logs.service';
import { FakeAuthGuard, createTestApp, url, TEST_USER } from './setup';

const FOOD_ID = '00000000-0000-4000-a000-000000000f01';
const SERVING_ID = '00000000-0000-4000-a000-0000000000a1';
const LOG_ID = '00000000-0000-4000-a000-0000000000b1';

describe('Meal Logs (e2e)', () => {
  let app: INestApplication;

  const mockLog = {
    id: LOG_ID,
    mealType: 'lunch',
    source: 'text',
    loggedAt: '2025-06-15T12:00:00.000Z',
    note: null,
    items: [{ foodId: FOOD_ID, servingId: SERVING_ID, quantity: 1, calories: 250 }],
    totalCalories: 250,
    totalProtein: 20,
    totalCarbs: 30,
    totalFat: 8,
  };

  const mockService = {
    createFromFood: jest.fn().mockResolvedValue(mockLog),
    quickAdd: jest.fn().mockResolvedValue({ ...mockLog, source: 'quick_add' }),
    findByUser: jest.fn().mockResolvedValue({
      data: [mockLog],
      meta: { total: 1, page: 1, limit: 50, totalPages: 1 },
    }),
    findById: jest.fn().mockResolvedValue(mockLog),
    update: jest.fn().mockResolvedValue({ ...mockLog, note: 'updated' }),
    remove: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [MealLogsController],
      providers: [
        { provide: MealLogsService, useValue: mockService },
        { provide: APP_GUARD, useClass: FakeAuthGuard },
      ],
    }).compile();
    app = await createTestApp(module);
  });

  afterAll(() => app?.close());
  afterEach(() => jest.clearAllMocks());

  /* ----- POST /meal-logs ----- */
  describe('POST /meal-logs', () => {
    const validBody = {
      mealType: 'lunch',
      source: 'text',
      items: [{ foodId: FOOD_ID, servingId: SERVING_ID, quantity: 1 }],
    };

    it('creates a meal log', () =>
      request(app.getHttpServer())
        .post(url('meal-logs'))
        .send(validBody)
        .expect(201)
        .expect((res) => {
          expect(res.body.data.id).toBe(LOG_ID);
          expect(mockService.createFromFood).toHaveBeenCalledWith(
            TEST_USER.id,
            expect.objectContaining({ mealType: 'lunch' }),
          );
        }));

    it('rejects empty items array', () =>
      request(app.getHttpServer())
        .post(url('meal-logs'))
        .send({ mealType: 'lunch', items: [] })
        .expect(400));

    it('rejects missing items', () =>
      request(app.getHttpServer()).post(url('meal-logs')).send({ mealType: 'lunch' }).expect(400));

    it('rejects invalid mealType', () =>
      request(app.getHttpServer())
        .post(url('meal-logs'))
        .send({
          mealType: 'brunch',
          items: [{ foodId: FOOD_ID, servingId: SERVING_ID, quantity: 1 }],
        })
        .expect(400));

    it('rejects negative quantity', () =>
      request(app.getHttpServer())
        .post(url('meal-logs'))
        .send({ items: [{ foodId: FOOD_ID, servingId: SERVING_ID, quantity: -1 }] })
        .expect(400));

    it('rejects note longer than 500 chars', () =>
      request(app.getHttpServer())
        .post(url('meal-logs'))
        .send({ ...validBody, note: 'x'.repeat(501) })
        .expect(400));
  });

  /* ----- POST /meal-logs/quick-add ----- */
  describe('POST /meal-logs/quick-add', () => {
    it('creates a quick-add log', () =>
      request(app.getHttpServer())
        .post(url('meal-logs/quick-add'))
        .send({ calories: 500, mealType: 'snack' })
        .expect(201)
        .expect((res) => {
          expect(res.body.data).toBeDefined();
          expect(mockService.quickAdd).toHaveBeenCalled();
        }));

    it('rejects negative calories', () =>
      request(app.getHttpServer())
        .post(url('meal-logs/quick-add'))
        .send({ calories: -100 })
        .expect(400));

    it('rejects missing calories', () =>
      request(app.getHttpServer())
        .post(url('meal-logs/quick-add'))
        .send({ mealType: 'lunch' })
        .expect(400));
  });

  /* ----- GET /meal-logs ----- */
  describe('GET /meal-logs', () => {
    it('lists meal logs with defaults', () =>
      request(app.getHttpServer())
        .get(url('meal-logs'))
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeInstanceOf(Array);
          expect(res.body.meta).toHaveProperty('total');
        }));

    it('accepts date filter', () =>
      request(app.getHttpServer()).get(url('meal-logs?date=2025-06-15')).expect(200));

    it('accepts pagination params', () =>
      request(app.getHttpServer()).get(url('meal-logs?page=2&limit=10')).expect(200));
  });

  /* ----- GET /meal-logs/:id ----- */
  describe('GET /meal-logs/:id', () => {
    it('returns a single meal log', () =>
      request(app.getHttpServer())
        .get(url(`meal-logs/${LOG_ID}`))
        .expect(200)
        .expect((res) => {
          expect(res.body.data.id).toBe(LOG_ID);
        }));
  });

  /* ----- PATCH /meal-logs/:id ----- */
  describe('PATCH /meal-logs/:id', () => {
    it('updates mealType', () =>
      request(app.getHttpServer())
        .patch(url(`meal-logs/${LOG_ID}`))
        .send({ mealType: 'dinner' })
        .expect(200));

    it('allows setting note to null', () =>
      request(app.getHttpServer())
        .patch(url(`meal-logs/${LOG_ID}`))
        .send({ note: null })
        .expect(200));

    it('rejects invalid mealType on update', () =>
      request(app.getHttpServer())
        .patch(url(`meal-logs/${LOG_ID}`))
        .send({ mealType: 'brunch' })
        .expect(400));
  });

  /* ----- DELETE /meal-logs/:id ----- */
  describe('DELETE /meal-logs/:id', () => {
    it('deletes a meal log', () =>
      request(app.getHttpServer())
        .delete(url(`meal-logs/${LOG_ID}`))
        .expect(204));
  });
});
