import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { QueueHealthService } from '../queue';
import { PrismaService } from '../prisma';

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: QueueHealthService, useValue: mockQueueHealth },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should return health status and probe the database', async () => {
    const result = await controller.check();
    expect(result.status).toBe('ok');
    expect(result.app).toBe('Coach');
    expect(result.timestamp).toBeDefined();
    expect(mockPrisma.$queryRaw).toHaveBeenCalled();
  });

  it('should return queue health', async () => {
    const result = await controller.checkQueues();
    expect(result.queues).toHaveLength(1);
    expect(result.queues[0].name).toBe('test-queue');
  });
});
