import { SubscriptionsService } from './subscriptions.service';
import { PrismaService } from '../prisma';
import { ConfigService } from '../config';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let prisma: Record<string, Record<string, jest.Mock>>;
  let configService: { revenueCatApiKey: string | undefined };

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
        create: jest.fn(),
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
    configService = { revenueCatApiKey: undefined };
    service = new SubscriptionsService(
      prisma as unknown as PrismaService,
      configService as unknown as ConfigService,
    );
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

  describe('verifyAndActivate', () => {
    it('falls back to DB status when no API key configured', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);

      const result = await service.verifyAndActivate('user-uuid');
      expect(result.tier).toBe('free');
    });

    it('activates subscription when RC says pro and no existing subscription', async () => {
      configService.revenueCatApiKey = 'test-key';
      const mockRcResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          subscriber: {
            entitlements: {
              'Coach Pro': {
                purchase_date: '2026-03-01T00:00:00Z',
                expires_date: '2026-04-01T00:00:00Z',
              },
            },
          },
        }),
      };
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(mockRcResponse as unknown as Response);
      prisma.subscription.findUnique.mockResolvedValue(null);
      prisma.subscription.create.mockResolvedValue({ id: 'new-sub', userId: 'user-uuid' });

      const result = await service.verifyAndActivate('user-uuid');

      expect(result.tier).toBe('pro');
      expect(prisma.subscription.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-uuid',
          tier: 'pro',
          status: 'active',
          provider: 'apple',
        }),
      });
      expect(prisma.subscriptionLedger.create).toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it('skips activation when DB already shows pro', async () => {
      configService.revenueCatApiKey = 'test-key';
      const mockRcResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          subscriber: {
            entitlements: {
              'Coach Pro': {
                purchase_date: '2026-03-01T00:00:00Z',
                expires_date: '2026-04-01T00:00:00Z',
              },
            },
          },
        }),
      };
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(mockRcResponse as unknown as Response);
      prisma.subscription.findUnique.mockResolvedValue(mockProSubscription);

      const result = await service.verifyAndActivate('user-uuid');

      expect(result.tier).toBe('pro');
      expect(prisma.subscription.update).not.toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it('returns DB status when RC has no pro entitlement', async () => {
      configService.revenueCatApiKey = 'test-key';
      const mockRcResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          subscriber: { entitlements: {} },
        }),
      };
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(mockRcResponse as unknown as Response);
      prisma.subscription.findUnique.mockResolvedValue(null);

      const result = await service.verifyAndActivate('user-uuid');

      expect(result.tier).toBe('free');
      expect(prisma.subscription.update).not.toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it('returns DB status when RC API fails', async () => {
      configService.revenueCatApiKey = 'test-key';
      jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('network error'));
      prisma.subscription.findUnique.mockResolvedValue(mockProSubscription);

      const result = await service.verifyAndActivate('user-uuid');

      expect(result.tier).toBe('pro');
      jest.restoreAllMocks();
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
    const RC_USER_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const makeRcPayload = (type: string, overrides = {}) => ({
      api_version: '1.0',
      event: {
        type,
        id: 'rc-event-id-1',
        app_user_id: RC_USER_UUID,
        original_app_user_id: RC_USER_UUID,
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
        id: RC_USER_UUID,
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
      prisma.user.findUnique.mockResolvedValue({ id: RC_USER_UUID, subscription: null });

      await service.handleRevenueCatWebhook(makeRcPayload('INITIAL_PURCHASE'));

      expect(prisma.subscription.create).toHaveBeenCalledWith({
        data: { userId: RC_USER_UUID, tier: 'free', status: 'active' },
      });
    });

    it('downgrades to free on EXPIRATION', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: RC_USER_UUID,
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

    it('silently skips non-UUID app_user_id (e.g. RC anonymous ID)', async () => {
      const result = await service.handleRevenueCatWebhook({
        api_version: '1.0',
        event: {
          type: 'INITIAL_PURCHASE',
          id: 'rc-event-anon',
          app_user_id: '$RCAnonymousID:abc123xyz',
          original_app_user_id: '$RCAnonymousID:abc123xyz',
          environment: 'PRODUCTION' as const,
          event_timestamp_ms: Date.now(),
          store: 'APP_STORE' as const,
          purchased_at_ms: Date.now(),
          expiration_at_ms: new Date('2026-04-01').getTime(),
          transaction_id: 'txn-anon',
          original_transaction_id: 'txn-anon-0',
        },
      });
      expect(result.success).toBe(true);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });
  });
});
