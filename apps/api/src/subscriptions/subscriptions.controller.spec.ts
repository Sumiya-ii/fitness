import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { ConfigService } from '../config';

describe('SubscriptionsController', () => {
  let controller: SubscriptionsController;
  let service: Record<string, jest.Mock>;
  let configService: { revenueCatWebhookSecret: string | undefined };

  const VALID_SECRET = 'test-webhook-secret';
  const VALID_AUTH = `Bearer ${VALID_SECRET}`;

  const validRcBody = {
    api_version: '1.0',
    event: {
      type: 'INITIAL_PURCHASE',
      id: 'rc-evt-001',
      app_user_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      original_app_user_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      environment: 'PRODUCTION',
      event_timestamp_ms: Date.now(),
      store: 'APP_STORE',
      purchased_at_ms: Date.now(),
      expiration_at_ms: new Date('2027-12-31').getTime(),
      transaction_id: 'txn-001',
      original_transaction_id: 'txn-000',
    },
  };

  const validWebhookBody = {
    event: 'started',
    provider: 'apple',
    userId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  };

  beforeEach(() => {
    service = {
      getStatus: jest
        .fn()
        .mockResolvedValue({ tier: 'free', status: 'active', currentPeriodEnd: null }),
      verifyAndActivate: jest.fn().mockResolvedValue({ tier: 'pro' }),
      handleWebhook: jest.fn().mockResolvedValue({ success: true }),
      handleRevenueCatWebhook: jest.fn().mockResolvedValue({ success: true }),
    };
    configService = { revenueCatWebhookSecret: VALID_SECRET };
    controller = new SubscriptionsController(
      service as unknown as SubscriptionsService,
      configService as unknown as ConfigService,
    );
  });

  // ---------------------------------------------------------------------------
  // GET /subscriptions/status
  // ---------------------------------------------------------------------------
  describe('getStatus', () => {
    it('returns data envelope with subscription status', async () => {
      const result = await controller.getStatus({ id: 'user-uuid' } as any);
      expect(result).toEqual({ data: { tier: 'free', status: 'active', currentPeriodEnd: null } });
      expect(service.getStatus).toHaveBeenCalledWith('user-uuid');
    });
  });

  // ---------------------------------------------------------------------------
  // POST /subscriptions/verify
  // ---------------------------------------------------------------------------
  describe('verify', () => {
    it('returns data envelope with tier from verifyAndActivate', async () => {
      const result = await controller.verify({ id: 'user-uuid' } as any);
      expect(result).toEqual({ data: { tier: 'pro' } });
      expect(service.verifyAndActivate).toHaveBeenCalledWith('user-uuid');
    });
  });

  // ---------------------------------------------------------------------------
  // POST /subscriptions/webhook — shared secret checks
  // ---------------------------------------------------------------------------
  describe('webhook', () => {
    it('rejects with 401 when secret is not configured', async () => {
      configService.revenueCatWebhookSecret = undefined;
      await expect(controller.webhook(VALID_AUTH, validWebhookBody)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects with 401 when Authorization header is missing', async () => {
      await expect(controller.webhook(undefined, validWebhookBody)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects with 401 when token does not match', async () => {
      await expect(controller.webhook('Bearer wrong-secret', validWebhookBody)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects with 401 when raw token (no Bearer prefix) does not match', async () => {
      await expect(controller.webhook('wrong-secret', validWebhookBody)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects with 401 when token is a different length (timing-safe path)', async () => {
      await expect(controller.webhook('Bearer short', validWebhookBody)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('accepts raw token without Bearer prefix when it matches the secret', async () => {
      const result = await controller.webhook(VALID_SECRET, validWebhookBody);
      expect(result).toEqual({ success: true });
    });

    it('delegates to service and returns result on valid secret', async () => {
      const result = await controller.webhook(VALID_AUTH, validWebhookBody);
      expect(service.handleWebhook).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'started', provider: 'apple' }),
      );
      expect(result).toEqual({ success: true });
    });

    it('throws BadRequestException on invalid body', async () => {
      await expect(
        controller.webhook(VALID_AUTH, { event: 'invalid-event', provider: 'apple' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('does NOT accept caller-supplied userId that bypasses auth (still reaches service with userId from body, but secret is required)', async () => {
      // The security fix is that the secret is now required. The userId in body
      // still lets an admin/internal caller target a specific user — that is intentional
      // for the internal adjustment use case. Without the secret you cannot reach the service.
      configService.revenueCatWebhookSecret = undefined;
      await expect(
        controller.webhook(VALID_AUTH, {
          event: 'started',
          provider: 'apple',
          userId: 'victim-uuid',
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(service.handleWebhook).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // POST /subscriptions/revenuecat-webhook — shared secret checks
  // ---------------------------------------------------------------------------
  describe('revenueCatWebhook', () => {
    it('rejects with 401 when secret is not configured', async () => {
      configService.revenueCatWebhookSecret = undefined;
      await expect(controller.revenueCatWebhook(VALID_AUTH, validRcBody)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects with 401 when Authorization header is missing', async () => {
      await expect(controller.revenueCatWebhook(undefined, validRcBody)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects with 401 when token does not match', async () => {
      await expect(
        controller.revenueCatWebhook('Bearer wrong-secret', validRcBody),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('accepts valid Bearer token and delegates to service', async () => {
      const result = await controller.revenueCatWebhook(VALID_AUTH, validRcBody);
      expect(service.handleRevenueCatWebhook).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('throws BadRequestException on malformed RC body', async () => {
      await expect(controller.revenueCatWebhook(VALID_AUTH, { unexpected: true })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('derives userId from event.app_user_id in payload, never from a caller-supplied top-level field', async () => {
      // The RC webhook schema has no top-level userId field — userId comes from event.app_user_id
      // in the payload, which the service validates is a real UUID in our DB.
      await controller.revenueCatWebhook(VALID_AUTH, validRcBody);
      const call = service.handleRevenueCatWebhook.mock.calls[0][0];
      expect(call).not.toHaveProperty('userId');
      expect(call.event.app_user_id).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    });
  });
});
