import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { Prisma } from '@prisma/client';
import type {
  ModerationQueryDto,
  RejectDto,
  MessageQueryDto,
  MessageStatsQueryDto,
} from './admin.dto';

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

  // ── Outbound message log ───────────────────────────────────────

  async listMessages(query: MessageQueryDto) {
    const where: Prisma.OutboundMessageWhereInput = {};

    if (query.userId) where.userId = query.userId;
    if (query.messageType) where.messageType = query.messageType;
    if (query.channel) where.channel = query.channel;
    if (query.status) where.status = query.status;
    if (query.startDate || query.endDate) {
      where.sentAt = {};
      if (query.startDate) where.sentAt.gte = new Date(query.startDate);
      if (query.endDate) where.sentAt.lte = new Date(query.endDate);
    }

    // Cursor: base64("{sentAt ISO}|{id}")
    let cursorCondition: Prisma.OutboundMessageWhereInput | undefined;
    if (query.cursor) {
      const decoded = Buffer.from(query.cursor, 'base64').toString('utf8');
      const [sentAtStr, id] = decoded.split('|');
      if (sentAtStr && id) {
        cursorCondition = {
          OR: [
            { sentAt: { lt: new Date(sentAtStr) } },
            { sentAt: new Date(sentAtStr), id: { lt: id } },
          ],
        };
      }
    }

    const finalWhere: Prisma.OutboundMessageWhereInput = cursorCondition
      ? { AND: [where, cursorCondition] }
      : where;

    const items = await this.prisma.outboundMessage.findMany({
      where: finalWhere,
      orderBy: [{ sentAt: 'desc' }, { id: 'desc' }],
      take: query.limit,
      include: {
        user: {
          select: {
            id: true,
            profile: { select: { displayName: true, locale: true } },
          },
        },
      },
    });

    const nextCursor =
      items.length === query.limit
        ? Buffer.from(
            `${items[items.length - 1]!.sentAt.toISOString()}|${items[items.length - 1]!.id}`,
          ).toString('base64')
        : null;

    return {
      data: items.map((m) => ({
        id: m.id,
        userId: m.userId,
        userName: m.user.profile?.displayName ?? null,
        locale: m.user.profile?.locale ?? 'mn',
        channel: m.channel,
        messageType: m.messageType,
        content: m.content,
        status: m.status,
        errorMessage: m.errorMessage,
        aiModel: m.aiModel,
        promptTokens: m.promptTokens,
        completionTokens: m.completionTokens,
        generationMs: m.generationMs,
        deliveryMs: m.deliveryMs,
        jobId: m.jobId,
        metadata: m.metadata,
        sentAt: m.sentAt.toISOString(),
      })),
      nextCursor,
    };
  }

  async getMessageStats(query: MessageStatsQueryDto) {
    const days = query.days;

    type DailyRow = { date: Date; total: bigint; failed: bigint };
    type TypeRow = { message_type: string; total: bigint; failed: bigint };
    type ChannelRow = { channel: string; total: bigint; failed: bigint };
    type TokenRow = {
      ai_model: string | null;
      avg_prompt: number;
      avg_completion: number;
      avg_generation_ms: number;
      count: bigint;
    };

    const [dailyVolume, byType, byChannel, aiTokens] = await Promise.all([
      this.prisma.$queryRaw<DailyRow[]>`
        SELECT
          DATE(sent_at) AS date,
          COUNT(*)::bigint AS total,
          COUNT(*) FILTER (WHERE status = 'failed')::bigint AS failed
        FROM outbound_messages
        WHERE sent_at >= NOW() - (${days} || ' days')::INTERVAL
        GROUP BY DATE(sent_at)
        ORDER BY date DESC
      `,
      this.prisma.$queryRaw<TypeRow[]>`
        SELECT
          message_type,
          COUNT(*)::bigint AS total,
          COUNT(*) FILTER (WHERE status = 'failed')::bigint AS failed
        FROM outbound_messages
        WHERE sent_at >= NOW() - (${days} || ' days')::INTERVAL
        GROUP BY message_type
        ORDER BY total DESC
      `,
      this.prisma.$queryRaw<ChannelRow[]>`
        SELECT
          channel,
          COUNT(*)::bigint AS total,
          COUNT(*) FILTER (WHERE status = 'failed')::bigint AS failed
        FROM outbound_messages
        WHERE sent_at >= NOW() - (${days} || ' days')::INTERVAL
        GROUP BY channel
      `,
      this.prisma.$queryRaw<TokenRow[]>`
        SELECT
          ai_model,
          ROUND(AVG(prompt_tokens))::float AS avg_prompt,
          ROUND(AVG(completion_tokens))::float AS avg_completion,
          ROUND(AVG(generation_ms))::float AS avg_generation_ms,
          COUNT(*)::bigint AS count
        FROM outbound_messages
        WHERE ai_model IS NOT NULL
          AND sent_at >= NOW() - (${days} || ' days')::INTERVAL
        GROUP BY ai_model
      `,
    ]);

    const totalSent = byChannel.reduce((s, r) => s + Number(r.total), 0);
    const totalFailed = byChannel.reduce((s, r) => s + Number(r.failed), 0);

    return {
      window: `last_${days}_days`,
      summary: {
        totalSent,
        totalFailed,
        successRate:
          totalSent > 0 ? Math.round(((totalSent - totalFailed) / totalSent) * 100) : 100,
      },
      dailyVolume: dailyVolume.map((r) => ({
        date: r.date.toISOString().slice(0, 10),
        total: Number(r.total),
        failed: Number(r.failed),
      })),
      byType: byType.map((r) => ({
        messageType: r.message_type,
        total: Number(r.total),
        failed: Number(r.failed),
        failureRate:
          Number(r.total) > 0 ? Math.round((Number(r.failed) / Number(r.total)) * 100) : 0,
      })),
      byChannel: byChannel.map((r) => ({
        channel: r.channel,
        total: Number(r.total),
        failed: Number(r.failed),
        failureRate:
          Number(r.total) > 0 ? Math.round((Number(r.failed) / Number(r.total)) * 100) : 0,
      })),
      aiCosts: aiTokens.map((r) => ({
        model: r.ai_model,
        messageCount: Number(r.count),
        avgPromptTokens: r.avg_prompt,
        avgCompletionTokens: r.avg_completion,
        avgGenerationMs: r.avg_generation_ms,
      })),
    };
  }
}
