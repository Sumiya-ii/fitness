import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { WaterLogsController } from '../../src/water-logs/water-logs.controller';
import { WaterLogsService } from '../../src/water-logs/water-logs.service';
import { FakeAuthGuard, createTestApp, url, TEST_USER } from './setup';

describe('Water Logs (e2e)', () => {
  let app: INestApplication;

  const mockWaterLog = { id: 'wl-1', amountMl: 250, loggedAt: '2025-06-15T12:00:00Z' };

  const mockService = {
    add: jest.fn().mockResolvedValue(mockWaterLog),
    getDaily: jest.fn().mockResolvedValue({ total: 1500, logs: [mockWaterLog], target: 2500 }),
    deleteLast: jest.fn().mockResolvedValue({ deleted: true }),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [WaterLogsController],
      providers: [
        { provide: WaterLogsService, useValue: mockService },
        { provide: APP_GUARD, useClass: FakeAuthGuard },
      ],
    }).compile();
    app = await createTestApp(module);
  });

  afterAll(() => app?.close());
  afterEach(() => jest.clearAllMocks());

  describe('POST /water-logs', () => {
    it('logs water intake', () =>
      request(app.getHttpServer())
        .post(url('water-logs'))
        .send({ amountMl: 250 })
        .expect(201)
        .expect((res) => {
          expect(res.body.data.amountMl).toBe(250);
        }));

    it('rejects amount below 1', () =>
      request(app.getHttpServer()).post(url('water-logs')).send({ amountMl: 0 }).expect(400));

    it('rejects amount above 5000', () =>
      request(app.getHttpServer()).post(url('water-logs')).send({ amountMl: 5001 }).expect(400));

    it('rejects missing amountMl', () =>
      request(app.getHttpServer()).post(url('water-logs')).send({}).expect(400));
  });

  describe('GET /water-logs', () => {
    it('returns daily water logs', () =>
      request(app.getHttpServer())
        .get(url('water-logs'))
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveProperty('total');
        }));

    it('accepts date param', () =>
      request(app.getHttpServer())
        .get(url('water-logs?date=2025-06-15'))
        .expect(200)
        .expect(() => {
          expect(mockService.getDaily).toHaveBeenCalledWith(TEST_USER.id, '2025-06-15');
        }));
  });

  describe('DELETE /water-logs/last', () => {
    it('deletes last water log', () =>
      request(app.getHttpServer())
        .delete(url('water-logs/last'))
        .expect(200)
        .expect((res) => {
          expect(res.body.data.deleted).toBe(true);
        }));
  });
});
