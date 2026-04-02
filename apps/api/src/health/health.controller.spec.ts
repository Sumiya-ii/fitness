import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { QueueHealthService } from '../queue';
import { PrismaService } from '../prisma';
import { ConfigService } from '../config';

// Mock ioredis so no real Redis connection is made in tests
const mockRedisPing = jest.fn().mockResolvedValue('PONG');
jest.mock('ioredis', () => jest.fn().mockImplementation(() => ({ ping: mockRedisPing })));

describe('HealthController', () => {
  let controller: HealthController;

  const mockQueueHealth: Partial<QueueHealthService> = {
    getHealth: jest.fn().mockResolvedValue([
      {
        name: 'test-queue',
        waiting: 0,
        active: 0,
        completed: 5,
        failed: 0,
        delayed: 0,
        paused: false,
      },
    ]),
  };

  const mockPrisma = {
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  };

  const mockConfig = { redisUrl: 'redis://localhost:6379' };

  function buildRes() {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    return { res: { status, json }, status, json };
  }

  beforeEach(async () => {
    mockRedisPing.mockResolvedValue('PONG');
    mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: QueueHealthService, useValue: mockQueueHealth },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns 200 ok when DB and Redis are both up', async () => {
    const { res, status, json } = buildRes();
    await controller.check(res as any);

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ok',
        app: 'Coach',
        services: { database: 'up', redis: 'up' },
      }),
    );
    expect(mockPrisma.$queryRaw).toHaveBeenCalled();
  });

  it('returns 503 degraded when DB is down', async () => {
    mockPrisma.$queryRaw.mockRejectedValueOnce(new Error('DB error'));
    const { res, status, json } = buildRes();
    await controller.check(res as any);

    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'degraded',
        services: { database: 'down', redis: 'up' },
      }),
    );
  });

  it('returns 503 degraded when Redis is down', async () => {
    mockRedisPing.mockRejectedValueOnce(new Error('Redis error'));
    const { res, status, json } = buildRes();
    await controller.check(res as any);

    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'degraded',
        services: { database: 'up', redis: 'down' },
      }),
    );
  });

  it('returns 503 degraded when both DB and Redis are down', async () => {
    mockPrisma.$queryRaw.mockRejectedValueOnce(new Error('DB error'));
    mockRedisPing.mockRejectedValueOnce(new Error('Redis error'));
    const { res, status, json } = buildRes();
    await controller.check(res as any);

    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'degraded',
        services: { database: 'down', redis: 'down' },
      }),
    );
  });

  it('includes timestamp in the response', async () => {
    const { res, json } = buildRes();
    await controller.check(res as any);

    const body = json.mock.calls[0][0];
    expect(body.timestamp).toBeDefined();
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it('should return queue health', async () => {
    const result = await controller.checkQueues();
    expect(result.queues).toHaveLength(1);
    expect(result.queues[0].name).toBe('test-queue');
  });
});
