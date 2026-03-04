import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma';
import type { WebhookPayloadDto } from './subscriptions.dto';

export type Entitlement = 'free' | 'pro';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(userId: string): Promise<{
    tier: Entitlement;
    status: string;
    currentPeriodEnd: string | null;
  }> {
    const existing = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!existing) {
      return {
        tier: 'free',
        status: 'active',
        currentPeriodEnd: null,
      };
    }

    const tier = existing.tier === 'pro' ? 'pro' : 'free';
    return {
      tier,
      status: existing.status,
      currentPeriodEnd: existing.currentPeriodEnd?.toISOString() ?? null,
    };
  }

  async checkEntitlement(userId: string): Promise<Entitlement> {
    const status = await this.getStatus(userId);
    return status.tier;
  }

  async handleWebhook(payload: WebhookPayloadDto): Promise<{ success: boolean }> {
    const { event, provider, providerEventId } = payload;

    if (providerEventId) {
      const externalSystem =
        provider === 'apple' ? 'apple_iap' : 'google_play';
      const existing = await this.prisma.idempotencyKey.findUnique({
        where: {
          externalSystem_externalEventId: {
            externalSystem,
            externalEventId: providerEventId,
          },
        },
      });
      if (existing) {
        return { success: true };
      }
    }

    const user = payload.userId
      ? await this.prisma.user.findUnique({
          where: { id: payload.userId },
          include: { subscription: true },
        })
      : payload.providerSubId
        ? await this.prisma.user.findFirst({
            where: {
              subscription: {
                providerSubId: payload.providerSubId,
              },
            },
            include: { subscription: true },
          })
        : null;

    if (!user) {
      return { success: false };
    }

    const subscription = user.subscription;
    if (!subscription) {
      return { success: false };
    }

    const subscriptionId = subscription.id;

    if (providerEventId) {
      await this.prisma.idempotencyKey.create({
        data: {
          externalSystem: provider === 'apple' ? 'apple_iap' : 'google_play',
          externalEventId: providerEventId,
          responseStatus: 200,
          responseBody: { success: true },
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      }).catch(() => {});
    }

    await this.prisma.subscriptionLedger.create({
      data: {
        subscriptionId,
        event,
        provider,
        providerEventId: providerEventId ?? null,
        metadata: payload.metadata as Prisma.InputJsonValue | undefined,
      },
    });

    const periodStart = payload.currentPeriodStart
      ? new Date(payload.currentPeriodStart)
      : null;
    const periodEnd = payload.currentPeriodEnd
      ? new Date(payload.currentPeriodEnd)
      : null;

    switch (event) {
      case 'started':
      case 'renewed':
        await this.prisma.subscription.update({
          where: { id: subscriptionId },
          data: {
            tier: 'pro',
            status: 'active',
            currentPeriodStart: periodStart ?? subscription.currentPeriodStart,
            currentPeriodEnd: periodEnd ?? subscription.currentPeriodEnd,
          },
        });
        break;
      case 'canceled':
        await this.prisma.subscription.update({
          where: { id: subscriptionId },
          data: { status: 'canceled' },
        });
        break;
      case 'expired':
      case 'refunded':
        await this.prisma.subscription.update({
          where: { id: subscriptionId },
          data: {
            tier: 'free',
            status: event === 'expired' ? 'expired' : 'canceled',
          },
        });
        break;
    }

    return { success: true };
  }
}
