import { NotFoundException } from '@nestjs/common';
import { CoachMemoryController } from './coach-memory.controller';
import { CoachMemoryService } from './coach-memory.service';
import type { AuthenticatedUser } from '../auth';

describe('CoachMemoryController', () => {
  let controller: CoachMemoryController;
  let service: { listMemories: jest.Mock; removeMemory: jest.Mock };

  const user: AuthenticatedUser = {
    id: 'user-uuid',
    firebaseUid: 'firebase-uid',
    email: null,
    phone: null,
  };

  const mockMemoryDto = {
    id: 'mem-uuid',
    category: 'foods',
    summary: 'Likes Mongolian food',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
  };

  beforeEach(() => {
    service = {
      listMemories: jest.fn().mockResolvedValue([mockMemoryDto]),
      removeMemory: jest.fn().mockResolvedValue(undefined),
    };
    controller = new CoachMemoryController(service as unknown as CoachMemoryService);
  });

  describe('list', () => {
    it('should return all memories for the authenticated user', async () => {
      const result = await controller.list(user);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('mem-uuid');
      expect(result.data[0].category).toBe('foods');
      expect(service.listMemories).toHaveBeenCalledWith('user-uuid');
    });

    it('should return ISO strings for dates', async () => {
      const result = await controller.list(user);
      expect(result.data[0].createdAt).toBe('2026-04-01T00:00:00.000Z');
      expect(result.data[0].updatedAt).toBe('2026-04-15T00:00:00.000Z');
    });

    it('should return empty array when user has no memories', async () => {
      service.listMemories.mockResolvedValue([]);
      const result = await controller.list(user);
      expect(result.data).toEqual([]);
    });
  });

  describe('remove', () => {
    it('should delete the memory when it belongs to the user', async () => {
      await controller.remove(user, 'mem-uuid');
      expect(service.removeMemory).toHaveBeenCalledWith('user-uuid', 'mem-uuid');
    });

    it('should propagate NotFoundException from service', async () => {
      service.removeMemory.mockRejectedValue(new NotFoundException('Memory not found'));
      await expect(controller.remove(user, 'missing-uuid')).rejects.toThrow(NotFoundException);
    });
  });
});
