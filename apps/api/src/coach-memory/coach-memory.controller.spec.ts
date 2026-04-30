import { NotFoundException } from '@nestjs/common';
import { CoachMemoryController } from './coach-memory.controller';
import { PrismaService } from '../prisma';
import type { AuthenticatedUser } from '../auth';

describe('CoachMemoryController', () => {
  let controller: CoachMemoryController;
  let prisma: {
    coachMemory: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      delete: jest.Mock;
    };
  };

  const user: AuthenticatedUser = {
    id: 'user-uuid',
    firebaseUid: 'firebase-uid',
    email: null,
    phone: null,
  };

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
    };
    controller = new CoachMemoryController(prisma as unknown as PrismaService);
  });

  describe('list', () => {
    it('should return all memories for the authenticated user', async () => {
      const result = await controller.list(user);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('mem-uuid');
      expect(result.data[0].category).toBe('foods');
      expect(prisma.coachMemory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-uuid' } }),
      );
    });

    it('should return ISO strings for dates', async () => {
      const result = await controller.list(user);
      expect(result.data[0].createdAt).toBe('2026-04-01T00:00:00.000Z');
      expect(result.data[0].updatedAt).toBe('2026-04-15T00:00:00.000Z');
    });

    it('should return empty array when user has no memories', async () => {
      prisma.coachMemory.findMany.mockResolvedValue([]);
      const result = await controller.list(user);
      expect(result.data).toEqual([]);
    });
  });

  describe('remove', () => {
    it('should delete the memory when it belongs to the user', async () => {
      await controller.remove(user, 'mem-uuid');
      expect(prisma.coachMemory.delete).toHaveBeenCalledWith({ where: { id: 'mem-uuid' } });
    });

    it('should throw NotFoundException when memory does not exist', async () => {
      prisma.coachMemory.findFirst.mockResolvedValue(null);
      await expect(controller.remove(user, 'missing-uuid')).rejects.toThrow(NotFoundException);
      expect(prisma.coachMemory.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when memory belongs to a different user', async () => {
      prisma.coachMemory.findFirst.mockResolvedValue(null); // findFirst scopes by userId
      await expect(controller.remove(user, 'other-user-memory')).rejects.toThrow(NotFoundException);
    });

    it('should scope findFirst to userId to prevent cross-user deletion', async () => {
      await controller.remove(user, 'mem-uuid');
      expect(prisma.coachMemory.findFirst).toHaveBeenCalledWith({
        where: { id: 'mem-uuid', userId: 'user-uuid' },
      });
    });
  });
});
