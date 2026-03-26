import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma';
import type { WebhookPayloadDto, RevenueCatWebhookDto } from './subscriptions.dto';

export type Entitlement = 'free' | 'pro';

// Maps RevenueCat event types to internal subscription events
const RC_EVENT_MAP: Record<string, string> = {
  INITIAL_PURCHASE: 'started',
  NON_RENEWING_PURCHASE: 'started',
  RENEWAL: 'renewed',
  UNCANCELLATION: 'renewed',
  PRODUCT_CHANGE: 'renewed',
  CANCELLATION: 'canceled',
  SUBSCRIPTION_PAUSED: 'canceled',
  EXPIRATION: 'expired',
  BILLING_ISSUES_DETECTED: 'expired',
  REFUND: 'refunded',
};

const STORE_MAP: Record<string, string> = {
  APP_STORE: 'apple',
  PLAY_STORE: 'google',
  AMAZON: 'google',
  STRIPE: 'stripe',
  PROMOTIONAL: 'promotional',
  RC_BILLING: 'stripe',
};

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

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
      return { tier: 'free', status: 'active', currentPeriodEnd: null };
    }

    // Treat expired/canceled subscriptions as free regardless of stored tier
    const isActive = existing.status === 'active';
    const notExpired = !existing.currentPeriodEnd || existing.currentPeriodEnd > new Date();
    const tier: Entitlement = existing.tier === 'pro' && isActive && notExpired ? 'pro' : 'free';

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

  // ---------------------------------------------------------------------------
  // Generic (internal/QPay) webhook
  // ---------------------------------------------------------------------------
  async handleWebhook(payload: WebhookPayloadDto): Promise<{ success: boolean }> {
    const { event, provider, providerEventId } = payload;

    if (providerEventId) {
      const externalSystem = provider === 'apple' ? 'apple_iap' : 'google_play';
      const existing = await this.prisma.idempotencyKey.findUnique({
        where: {
          externalSystem_externalEventId: {
            externalSystem,
            externalEventId: providerEventId,
          },
        },
      });
      if (existing) return { success: true };
    }

    const user = payload.userId
      ? await this.prisma.user.findUnique({
          where: { id: payload.userId },
          include: { subscription: true },
        })
      : payload.providerSubId
        ? await this.prisma.user.findFirst({
            where: { subscription: { providerSubId: payload.providerSubId } },
            include: { subscription: true },
          })
        : null;

    if (!user) return { success: false };

    const subscription = user.subscription;
    if (!subscription) return { success: false };

    if (providerEventId) {
      await this.prisma.idempotencyKey
        .create({
          data: {
            externalSystem: provider === 'apple' ? 'apple_iap' : 'google_play',
            externalEventId: providerEventId,
            responseStatus: 200,
            responseBody: { success: true },
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        })
        .catch(() => {});
    }

    await this.prisma.subscriptionLedger.create({
      data: {
        subscriptionId: subscription.id,
        event,
        provider,
        providerEventId: providerEventId ?? null,
        metadata: payload.metadata as Prisma.InputJsonValue | undefined,
      },
    });

    const periodStart = payload.currentPeriodStart ? new Date(payload.currentPeriodStart) : null;
    const periodEnd = payload.currentPeriodEnd ? new Date(payload.currentPeriodEnd) : null;

    await this.applySubscriptionEvent(subscription.id, event, {
      periodStart,
      periodEnd,
      provider,
    });

    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // RevenueCat server-to-server webhook
  // ---------------------------------------------------------------------------
  async handleRevenueCatWebhook(payload: RevenueCatWebhookDto): Promise<{ success: boolean }> {
    const { event } = payload;

    // TRANSFER events change the app_user_id mapping — no subscription state change
    if (event.type === 'TRANSFER') return { success: true };

    // Idempotency check
    const alreadyProcessed = await this.prisma.idempotencyKey.findUnique({
      where: {
        externalSystem_externalEventId: {
          externalSystem: 'revenuecat',
          externalEventId: event.id,
        },
      },
    });
    if (alreadyProcessed) return { success: true };

    const internalEvent = RC_EVENT_MAP[event.type];
    if (!internalEvent) {
      this.logger.warn(`Unhandled RevenueCat event type: ${event.type}`);
      return { success: true };
    }

    // Find user — app_user_id is our internal UUID passed to Purchases.logIn()
    const user = await this.prisma.user.findUnique({
      where: { id: event.app_user_id },
      include: { subscription: true },
    });

    if (!user) {
      this.logger.warn(`RevenueCat webhook: user not found for app_user_id=${event.app_user_id}`);
      return { success: false };
    }

    // Ensure subscription row exists
    let subscription = user.subscription;
    if (!subscription) {
      subscription = await this.prisma.subscription.create({
        data: { userId: user.id, tier: 'free', status: 'active' },
      });
    }

    const provider = STORE_MAP[event.store] ?? 'apple';

    // Audit ledger
    await this.prisma.subscriptionLedger.create({
      data: {
        subscriptionId: subscription.id,
        event: internalEvent,
        provider,
        providerEventId: event.id,
        metadata: event as unknown as Prisma.InputJsonValue,
      },
    });

    const periodStart = event.purchased_at_ms ? new Date(event.purchased_at_ms) : null;
    const periodEnd = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;
    const providerSubId = event.original_transaction_id ?? event.transaction_id ?? null;

    await this.applySubscriptionEvent(subscription.id, internalEvent, {
      periodStart,
      periodEnd,
      provider,
      providerSubId: providerSubId ?? undefined,
    });

    // Store idempotency key — 30-day retention matches RC event replay window
    await this.prisma.idempotencyKey
      .create({
        data: {
          externalSystem: 'revenuecat',
          externalEventId: event.id,
          responseStatus: 200,
          responseBody: { success: true },
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      })
      .catch(() => {}); // race-safe: ignore duplicate key errors

    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Shared state machine — applies subscription lifecycle events to DB
  // ---------------------------------------------------------------------------
  private async applySubscriptionEvent(
    subscriptionId: string,
    event: string,
    opts: {
      periodStart?: Date | null;
      periodEnd?: Date | null;
      provider?: string;
      providerSubId?: string;
    },
  ): Promise<void> {
    const { periodStart, periodEnd, provider, providerSubId } = opts;

    switch (event) {
      case 'started':
      case 'renewed':
        await this.prisma.subscription.update({
          where: { id: subscriptionId },
          data: {
            tier: 'pro',
            status: 'active',
            ...(provider && { provider }),
            ...(providerSubId && { providerSubId }),
            ...(periodStart && { currentPeriodStart: periodStart }),
            ...(periodEnd && { currentPeriodEnd: periodEnd }),
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
        await this.prisma.subscription.update({
          where: { id: subscriptionId },
          data: { tier: 'free', status: 'expired' },
        });
        break;
      case 'refunded':
        await this.prisma.subscription.update({
          where: { id: subscriptionId },
          data: { tier: 'free', status: 'canceled' },
        });
        break;
      default:
        this.logger.warn(`applySubscriptionEvent: unknown event "${event}"`);
    }
  }
}
