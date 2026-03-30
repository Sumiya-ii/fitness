import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { WorkoutLogsController } from '../../src/workout-logs/workout-logs.controller';
import { WorkoutLogsService } from '../../src/workout-logs/workout-logs.service';
import { FakeAuthGuard, createTestApp, url } from './setup';

const LOG_ID = '00000000-0000-4000-a000-000000000w01';

describe('Workout Logs (e2e)', () => {
  let app: INestApplication;

  const mockLog = {
    id: LOG_ID,
    workoutType: 'running',
    durationMin: 30,
    caloriesBurned: 300,
    note: null,
    loggedAt: '2025-06-15T08:00:00Z',
  };

  const mockService = {
    getTypes: jest.fn().mockReturnValue([{ category: 'cardio', types: ['running', 'cycling'] }]),
    getTypeList: jest.fn().mockReturnValue(['running', 'cycling', 'swimming']),
    estimate: jest.fn().mockResolvedValue({ caloriesBurned: 300, durationMin: 30 }),
    getRecents: jest.fn().mockResolvedValue([{ workoutType: 'running', count: 5 }]),
    getWeeklySummary: jest
      .fn()
      .mockResolvedValue({ totalMinutes: 120, totalCalories: 900, sessions: 3 }),
    create: jest.fn().mockResolvedValue(mockLog),
    findByUser: jest.fn().mockResolvedValue({
      data: [mockLog],
      meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
    }),
    findById: jest.fn().mockResolvedValue(mockLog),
    update: jest.fn().mockResolvedValue({ ...mockLog, note: 'felt great' }),
    remove: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [WorkoutLogsController],
      providers: [
        { provide: WorkoutLogsService, useValue: mockService },
        { provide: APP_GUARD, useClass: FakeAuthGuard },
      ],
    }).compile();
    app = await createTestApp(module);
  });

  afterAll(() => app?.close());
  afterEach(() => jest.clearAllMocks());

  /* ----- Public endpoints ----- */
  describe('GET /workout-logs/types', () => {
    it('returns categorized workout types', () =>
      request(app.getHttpServer())
        .get(url('workout-logs/types'))
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeInstanceOf(Array);
        }));
  });

  describe('GET /workout-logs/types/list', () => {
    it('returns flat type list', () =>
      request(app.getHttpServer())
        .get(url('workout-logs/types/list'))
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeInstanceOf(Array);
          expect(res.body.data).toContain('running');
        }));
  });

  /* ----- Authenticated endpoints ----- */
  describe('GET /workout-logs/estimate', () => {
    it('estimates calorie burn', () =>
      request(app.getHttpServer())
        .get(url('workout-logs/estimate?workoutType=running&durationMin=30'))
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveProperty('caloriesBurned');
        }));

    it('rejects missing workoutType', () =>
      request(app.getHttpServer()).get(url('workout-logs/estimate?durationMin=30')).expect(400));

    it('rejects missing durationMin', () =>
      request(app.getHttpServer())
        .get(url('workout-logs/estimate?workoutType=running'))
        .expect(400));
  });

  describe('GET /workout-logs/recents', () => {
    it('returns recent workout types', () =>
      request(app.getHttpServer())
        .get(url('workout-logs/recents'))
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeInstanceOf(Array);
        }));
  });

  describe('GET /workout-logs/summary', () => {
    it('returns weekly summary', () =>
      request(app.getHttpServer())
        .get(url('workout-logs/summary'))
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveProperty('totalMinutes');
          expect(res.body.data).toHaveProperty('sessions');
        }));
  });

  describe('POST /workout-logs', () => {
    it('creates a workout log', () =>
      request(app.getHttpServer())
        .post(url('workout-logs'))
        .send({ workoutType: 'running', durationMin: 30 })
        .expect(201)
        .expect((res) => {
          expect(res.body.data.workoutType).toBe('running');
        }));

    it('creates with minimal fields', () =>
      request(app.getHttpServer())
        .post(url('workout-logs'))
        .send({ workoutType: 'yoga' })
        .expect(201));

    it('rejects missing workoutType', () =>
      request(app.getHttpServer()).post(url('workout-logs')).send({ durationMin: 30 }).expect(400));

    it('rejects durationMin above 1440', () =>
      request(app.getHttpServer())
        .post(url('workout-logs'))
        .send({ workoutType: 'running', durationMin: 1500 })
        .expect(400));

    it('rejects durationMin below 1', () =>
      request(app.getHttpServer())
        .post(url('workout-logs'))
        .send({ workoutType: 'running', durationMin: 0 })
        .expect(400));

    it('rejects workoutType longer than 50 chars', () =>
      request(app.getHttpServer())
        .post(url('workout-logs'))
        .send({ workoutType: 'x'.repeat(51), durationMin: 30 })
        .expect(400));
  });

  describe('GET /workout-logs', () => {
    it('lists workout logs', () =>
      request(app.getHttpServer())
        .get(url('workout-logs'))
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeInstanceOf(Array);
          expect(res.body.meta).toHaveProperty('total');
        }));

    it('accepts date filter', () =>
      request(app.getHttpServer()).get(url('workout-logs?date=2025-06-15')).expect(200));

    it('accepts pagination', () =>
      request(app.getHttpServer()).get(url('workout-logs?page=1&limit=5')).expect(200));
  });

  describe('GET /workout-logs/:id', () => {
    it('returns a single workout log', () =>
      request(app.getHttpServer())
        .get(url(`workout-logs/${LOG_ID}`))
        .expect(200)
        .expect((res) => {
          expect(res.body.data.id).toBe(LOG_ID);
        }));
  });

  describe('PATCH /workout-logs/:id', () => {
    it('updates a workout log', () =>
      request(app.getHttpServer())
        .patch(url(`workout-logs/${LOG_ID}`))
        .send({ note: 'felt great' })
        .expect(200));

    it('allows setting note to null', () =>
      request(app.getHttpServer())
        .patch(url(`workout-logs/${LOG_ID}`))
        .send({ note: null })
        .expect(200));

    it('rejects durationMin above 1440 on update', () =>
      request(app.getHttpServer())
        .patch(url(`workout-logs/${LOG_ID}`))
        .send({ durationMin: 2000 })
        .expect(400));
  });

  describe('DELETE /workout-logs/:id', () => {
    it('deletes a workout log', () =>
      request(app.getHttpServer())
        .delete(url(`workout-logs/${LOG_ID}`))
        .expect(204));
  });
});
