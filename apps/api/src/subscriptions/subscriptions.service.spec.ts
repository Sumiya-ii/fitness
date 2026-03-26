import { SubscriptionsService } from './subscriptions.service';
import { PrismaService } from '../prisma';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let prisma: Record<string, Record<string, jest.Mock>>;

  const mockSubscription = {
    id: 'sub-uuid',
    userId: 'user-uuid',
    tier: 'free',
    status: 'active',
    provider: null,
    providerSubId: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProSubscription = {
    ...mockSubscription,
    tier: 'pro',
    provider: 'apple',
    providerSubId: 'apple-sub-123',
    currentPeriodEnd: new Date('2026-04-01'),
  };

  beforeEach(() => {
    prisma = {
      subscription: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      subscriptionLedger: {
        create: jest.fn().mockResolvedValue({ id: 'ledger-uuid' }),
      },
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      idempotencyKey: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    service = new SubscriptionsService(prisma as unknown as PrismaService);
  });

  describe('getStatus', () => {
    it('should return free tier when no subscription', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);

      const result = await service.getStatus('user-uuid');
      expect(result.tier).toBe('free');
      expect(result.status).toBe('active');
      expect(result.currentPeriodEnd).toBeNull();
    });

    it('should return pro tier when subscription is pro', async () => {
      prisma.subscription.findUnique.mockResolvedValue(mockProSubscription);

      const result = await service.getStatus('user-uuid');
      expect(result.tier).toBe('pro');
      expect(result.status).toBe('active');
      expect(result.currentPeriodEnd).toBe('2026-04-01T00:00:00.000Z');
    });
  });

  describe('checkEntitlement', () => {
    it('should return free for free tier', async () => {
      prisma.subscription.findUnique.mockResolvedValue(mockSubscription);
      expect(await service.checkEntitlement('user-uuid')).toBe('free');
    });

    it('should return pro for pro tier', async () => {
      prisma.subscription.findUnique.mockResolvedValue(mockProSubscription);
      expect(await service.checkEntitlement('user-uuid')).toBe('pro');
    });
  });

  describe('handleWebhook', () => {
    it('should create ledger entry and update subscription on started', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-uuid',
        subscription: mockSubscription,
      });

      const result = await service.handleWebhook({
        event: 'started',
        provider: 'apple',
        providerEventId: 'evt-123',
        userId: 'user-uuid',
        currentPeriodStart: '2026-03-01T00:00:00Z',
        currentPeriodEnd: '2026-04-01T00:00:00Z',
      });

      expect(result.success).toBe(true);
      expect(prisma.subscriptionLedger.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          event: 'started',
          provider: 'apple',
          providerEventId: 'evt-123',
        }),
      });
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-uuid' },
        data: expect.objectContaining({
          tier: 'pro',
          status: 'active',
        }),
      });
    });

    it('should downgrade to free on expired', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-uuid',
        subscription: mockProSubscription,
      });

      await service.handleWebhook({
        event: 'expired',
        provider: 'apple',
        userId: 'user-uuid',
      });

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-uuid' },
        data: { tier: 'free', status: 'expired' },
      });
    });
  });

  describe('handleRevenueCatWebhook', () => {
    const makeRcPayload = (type: string, overrides = {}) => ({
      api_version: '1.0',
      event: {
        type,
        id: 'rc-event-id-1',
        app_user_id: 'user-uuid',
        original_app_user_id: 'user-uuid',
        environment: 'PRODUCTION' as const,
        event_timestamp_ms: Date.now(),
        store: 'APP_STORE' as const,
        purchased_at_ms: Date.now(),
        expiration_at_ms: new Date('2026-04-01').getTime(),
        transaction_id: 'txn-001',
        original_transaction_id: 'txn-000',
        ...overrides,
      },
    });

    it('upgrades to pro on INITIAL_PURCHASE', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-uuid',
        subscription: mockSubscription,
      });

      const result = await service.handleRevenueCatWebhook(makeRcPayload('INITIAL_PURCHASE'));

      expect(result.success).toBe(true);
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-uuid' },
        data: expect.objectContaining({ tier: 'pro', status: 'active', provider: 'apple' }),
      });
      expect(prisma.idempotencyKey.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            externalSystem: 'revenuecat',
            externalEventId: 'rc-event-id-1',
          }),
        }),
      );
    });

    it('creates a subscription row if none exists', async () => {
      prisma.subscription.create = jest.fn().mockResolvedValue(mockSubscription);
      prisma.user.findUnique.mockResolvedValue({ id: 'user-uuid', subscription: null });

      await service.handleRevenueCatWebhook(makeRcPayload('INITIAL_PURCHASE'));

      expect(prisma.subscription.create).toHaveBeenCalledWith({
        data: { userId: 'user-uuid', tier: 'free', status: 'active' },
      });
    });

    it('downgrades to free on EXPIRATION', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-uuid',
        subscription: mockProSubscription,
      });

      await service.handleRevenueCatWebhook(makeRcPayload('EXPIRATION', { id: 'rc-event-id-2' }));

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-uuid' },
        data: { tier: 'free', status: 'expired' },
      });
    });

    it('is idempotent — skips duplicate event IDs', async () => {
      prisma.idempotencyKey.findUnique.mockResolvedValue({ id: 'existing' });

      const result = await service.handleRevenueCatWebhook(makeRcPayload('RENEWAL'));

      expect(result.success).toBe(true);
      expect(prisma.subscription.update).not.toHaveBeenCalled();
    });

    it('skips TRANSFER events without error', async () => {
      const result = await service.handleRevenueCatWebhook(makeRcPayload('TRANSFER'));
      expect(result.success).toBe(true);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('returns false when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const result = await service.handleRevenueCatWebhook(makeRcPayload('INITIAL_PURCHASE'));
      expect(result.success).toBe(false);
    });
  });
});
