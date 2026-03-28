import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { HealthController } from '../../src/health/health.controller';
import { QueueHealthService } from '../../src/queue';
import { createTestApp, url } from './setup';

describe('Health (e2e)', () => {
  let app: INestApplication;
  const mockQueueHealth = { getHealth: jest.fn().mockResolvedValue([]) };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: QueueHealthService, useValue: mockQueueHealth }],
    }).compile();
    app = await createTestApp(module);
  });

  afterAll(() => app?.close());

  it('GET /health → 200 with status ok', () =>
    request(app.getHttpServer())
      .get(url('health'))
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('ok');
        expect(res.body.app).toBe('Coach');
        expect(res.body).toHaveProperty('timestamp');
      }));
});
