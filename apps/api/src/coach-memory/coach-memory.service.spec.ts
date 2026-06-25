import { NotFoundException } from '@nestjs/common';
import { CoachMemoryService } from './coach-memory.service';
import { PrismaService } from '../prisma';
import { Queue } from 'bullmq';

describe('CoachMemoryService', () => {
  let service: CoachMemoryService;
  let prisma: {
    coachMemory: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      delete: jest.Mock;
    };
    user: { findMany: jest.Mock };
  };
  let queue: { add: jest.Mock };

  const mockMemory = {
    id: 'mem-uuid',
    userId: 'user-uuid',
    category: 'foods',
    summary: 'Likes Mongolian food',
    createdAt: new Date('2026-04-01'),
    updatedAt: new Date('2026-04-15'),
  };

  beforeEach(() => {
    prisma = {
      coachMemory: {
        findMany: jest.fn().mockResolvedValue([mockMemory]),
        findFirst: jest.fn().mockResolvedValue(mockMemory),
        delete: jest.fn().mockResolvedValue(mockMemory),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    queue = { add: jest.fn().mockResolvedValue(undefined) };
    service = new CoachMemoryService(prisma as unknown as PrismaService, queue as unknown as Queue);
  });

  describe('listMemories', () => {
    it('should return mapped memories for the user', async () => {
      const result = await service.listMemories('user-uuid');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('mem-uuid');
      expect(result[0].category).toBe('foods');
      expect(result[0].createdAt).toBe('2026-04-01T00:00:00.000Z');
      expect(result[0].updatedAt).toBe('2026-04-15T00:00:00.000Z');
      expect(prisma.coachMemory.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-uuid' },
        orderBy: { updatedAt: 'desc' },
      });
    });

    it('should return empty array when user has no memories', async () => {
      prisma.coachMemory.findMany.mockResolvedValue([]);
      const result = await service.listMemories('user-uuid');
      expect(result).toEqual([]);
    });
  });

  describe('removeMemory', () => {
    it('should delete when memory belongs to the user', async () => {
      await service.removeMemory('user-uuid', 'mem-uuid');
      expect(prisma.coachMemory.findFirst).toHaveBeenCalledWith({
        where: { id: 'mem-uuid', userId: 'user-uuid' },
      });
      expect(prisma.coachMemory.delete).toHaveBeenCalledWith({ where: { id: 'mem-uuid' } });
    });

    it('should throw NotFoundException when memory does not exist', async () => {
      prisma.coachMemory.findFirst.mockResolvedValue(null);
      await expect(service.removeMemory('user-uuid', 'missing')).rejects.toThrow(NotFoundException);
      expect(prisma.coachMemory.delete).not.toHaveBeenCalled();
    });

    it('should scope findFirst to userId to prevent cross-user deletion', async () => {
      prisma.coachMemory.findFirst.mockResolvedValue(null);
      await expect(service.removeMemory('other-user', 'mem-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('scheduleRefresh', () => {
    it('should return 0 when no onboarded users exist', async () => {
      const count = await service.scheduleRefresh();
      expect(count).toBe(0);
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('should enqueue one job per user and return count', async () => {
      prisma.user.findMany.mockResolvedValueOnce([
        { id: 'u1', profile: { locale: 'mn' } },
        { id: 'u2', profile: { locale: 'en' } },
      ]);

      const count = await service.scheduleRefresh();
      expect(count).toBe(2);
      expect(queue.add).toHaveBeenCalledTimes(2);
      expect(queue.add).toHaveBeenCalledWith(
        'refresh',
        { userId: 'u1', locale: 'mn' },
        expect.objectContaining({ jobId: 'coach-memory-u1' }),
      );
    });

    it('should paginate users in batches and enqueue all', async () => {
      // First batch returns BATCH_SIZE (200) items, second batch returns 0 (done).
      const batch1 = Array.from({ length: 200 }, (_, i) => ({
        id: `u${i}`,
        profile: { locale: 'mn' },
      }));

      prisma.user.findMany.mockResolvedValueOnce(batch1).mockResolvedValueOnce([]); // second page empty → loop exits

      const count = await service.scheduleRefresh();
      expect(count).toBe(200);
      expect(prisma.user.findMany).toHaveBeenCalledTimes(2);

      // Second call must include cursor
      const secondCall = prisma.user.findMany.mock.calls[1][0] as {
        cursor: { id: string };
        skip: number;
      };
      expect(secondCall.cursor).toEqual({ id: 'u199' });
      expect(secondCall.skip).toBe(1);
    });

    it('should use locale mn as fallback when profile has no locale', async () => {
      prisma.user.findMany.mockResolvedValueOnce([{ id: 'u1', profile: null }]);

      await service.scheduleRefresh();
      expect(queue.add).toHaveBeenCalledWith(
        'refresh',
        { userId: 'u1', locale: 'mn' },
        expect.anything(),
      );
    });
  });
});
