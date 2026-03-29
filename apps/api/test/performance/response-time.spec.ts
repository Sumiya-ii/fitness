/**
 * C-035: Performance Test Pack (NFR-001..003)
 * Unit-test-style timing checks with mocked services.
 * Verifies key endpoints respond within acceptable time limits.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from '../../src/health/health.controller';
import { QueueHealthService } from '../../src/queue';
import { DashboardService } from '../../src/dashboard/dashboard.service';
import { FoodsService } from '../../src/foods/foods.service';

const HEALTH_MS = 100;
const DASHBOARD_MS = 500;
const FOOD_SEARCH_MS = 500;

describe('Performance: Response Time (NFR-001..003)', () => {
  describe('Health endpoint', () => {
    it('should respond within 100ms', async () => {
      const mockQueueHealth = {
        getHealth: jest.fn().mockResolvedValue([]),
      };

      const module: TestingModule = await Test.createTestingModule({
        controllers: [HealthController],
        providers: [{ provide: QueueHealthService, useValue: mockQueueHealth }],
      }).compile();

      const controller = module.get<HealthController>(HealthController);

      const start = Date.now();
      controller.check();
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(HEALTH_MS);
      expect(elapsed).toBeLessThanOrEqual(HEALTH_MS);
    });
  });

  describe('Dashboard query', () => {
    it('should respond within 500ms with mocked service', async () => {
      const mockPrisma = {
        mealLog: { findMany: jest.fn().mockResolvedValue([]) },
        target: { findFirst: jest.fn().mockResolvedValue(null) },
      };

      const service = new DashboardService(mockPrisma as any);

      const start = Date.now();
      await service.getDailyDashboard('user-uuid');
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(DASHBOARD_MS);
    });
  });

  describe('Food search', () => {
    it('should respond within 500ms with mocked service', async () => {
      const mockPrisma = {
        food: {
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(0),
        },
      };

      const service = new FoodsService(mockPrisma as any);

      const start = Date.now();
      await service.findMany({ page: 1, limit: 20, search: 'rice' });
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(FOOD_SEARCH_MS);
    });
  });
});
