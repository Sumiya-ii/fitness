import { NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: {
    moderationQueue: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
    };
    food: { update: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  const mockQueueItem = {
    id: 'queue-uuid',
    entityType: 'food',
    entityId: 'food-uuid',
    submittedBy: 'user-uuid',
    status: 'pending',
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: null,
    createdAt: new Date('2026-03-04'),
    updatedAt: new Date('2026-03-04'),
  };

  beforeEach(() => {
    prisma = {
      moderationQueue: {
        findUnique: jest.fn().mockResolvedValue(mockQueueItem),
        findMany: jest.fn().mockResolvedValue([mockQueueItem]),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn().mockResolvedValue({ ...mockQueueItem, status: 'approved' }),
      },
      food: {
        update: jest.fn().mockResolvedValue({}),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-uuid' }),
      },
      $transaction: jest.fn((fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
    };
    service = new AdminService(prisma as unknown as PrismaService);
  });

  describe('listModerationQueue', () => {
    it('should return paginated moderation queue', async () => {
      const result = await service.listModerationQueue({
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].entityType).toBe('food');
      expect(result.data[0].status).toBe('pending');
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
    });

    it('should filter by status', async () => {
      await service.listModerationQueue({
        status: 'pending',
        page: 1,
        limit: 20,
      });

      expect(prisma.moderationQueue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'pending' },
        }),
      );
    });
  });

  describe('approve', () => {
    it('should write audit entry on approve', async () => {
      const result = await service.approve('admin-uuid', 'queue-uuid');

      expect(result.success).toBe(true);
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: 'admin-uuid',
          actorRole: 'admin',
          action: 'moderation.approve',
          entityType: 'food',
          entityId: 'food-uuid',
        }),
      });
    });

    it('should throw when item not found', async () => {
      prisma.moderationQueue.findUnique.mockResolvedValue(null);
      await expect(service.approve('admin-uuid', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('reject', () => {
    it('should write audit entry on reject', async () => {
      const result = await service.reject('admin-uuid', 'queue-uuid', {
        note: 'Duplicate entry',
      });

      expect(result.success).toBe(true);
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: 'admin-uuid',
          actorRole: 'admin',
          action: 'moderation.reject',
          entityType: 'food',
          entityId: 'food-uuid',
          changes: expect.objectContaining({ note: 'Duplicate entry' }),
        }),
      });
    });

    it('should throw when item not found', async () => {
      prisma.moderationQueue.findUnique.mockResolvedValue(null);
      await expect(service.reject('admin-uuid', 'missing')).rejects.toThrow(NotFoundException);
    });
  });
});
