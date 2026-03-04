import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma';
import type { ModerationQueryDto, RejectDto } from './admin.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listModerationQueue(query: ModerationQueryDto) {
    const where: { status?: string } = {};
    if (query.status) where.status = query.status;

    const [items, total] = await Promise.all([
      this.prisma.moderationQueue.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.moderationQueue.count({ where }),
    ]);

    return {
      data: items.map((item) => ({
        id: item.id,
        entityType: item.entityType,
        entityId: item.entityId,
        submittedBy: item.submittedBy,
        status: item.status,
        reviewedBy: item.reviewedBy,
        reviewedAt: item.reviewedAt?.toISOString() ?? null,
        reviewNote: item.reviewNote,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
      },
    };
  }

  async approve(actorId: string, queueId: string) {
    const item = await this.prisma.moderationQueue.findUnique({
      where: { id: queueId },
    });

    if (!item) {
      throw new NotFoundException('Moderation item not found');
    }

    if (item.status !== 'pending') {
      throw new NotFoundException('Item is not pending');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.moderationQueue.update({
        where: { id: queueId },
        data: {
          status: 'approved',
          reviewedBy: actorId,
          reviewedAt: new Date(),
        },
      });

      if (item.entityType === 'food') {
        await tx.food.update({
          where: { id: item.entityId },
          data: {
            status: 'approved',
            verifiedBy: actorId,
            verifiedAt: new Date(),
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId,
          actorRole: 'admin',
          action: 'moderation.approve',
          entityType: item.entityType,
          entityId: item.entityId,
          changes: { queueId, previousStatus: item.status },
        },
      });
    });

    return { success: true };
  }

  async reject(actorId: string, queueId: string, dto?: RejectDto) {
    const item = await this.prisma.moderationQueue.findUnique({
      where: { id: queueId },
    });

    if (!item) {
      throw new NotFoundException('Moderation item not found');
    }

    if (item.status !== 'pending') {
      throw new NotFoundException('Item is not pending');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.moderationQueue.update({
        where: { id: queueId },
        data: {
          status: 'rejected',
          reviewedBy: actorId,
          reviewedAt: new Date(),
          reviewNote: dto?.note ?? null,
        },
      });

      if (item.entityType === 'food') {
        await tx.food.update({
          where: { id: item.entityId },
          data: { status: 'rejected' },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId,
          actorRole: 'admin',
          action: 'moderation.reject',
          entityType: item.entityType,
          entityId: item.entityId,
          changes: { queueId, previousStatus: item.status, note: dto?.note },
        },
      });
    });

    return { success: true };
  }
}
