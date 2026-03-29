/**
 * C-037: Security/Privacy Verification Pack
 * Verifies consent creation stores version and type correctly,
 * privacy requests are created with proper status.
 */
import { PrivacyService } from '../../src/privacy/privacy.service';
import { PrismaService } from '../../src/prisma';

describe('Security: Consent and Privacy', () => {
  let service: PrivacyService;
  let prisma: Record<string, Record<string, jest.Mock>>;

  const mockConsent = {
    id: 'consent-uuid',
    userId: 'user-uuid',
    consentType: 'health_data',
    version: '1.0',
    accepted: true,
    ipAddress: null,
    userAgent: null,
    createdAt: new Date('2026-03-04'),
  };

  const mockPrivacyRequest = {
    id: 'req-uuid',
    userId: 'user-uuid',
    requestType: 'export',
    status: 'pending',
    completedAt: null,
    resultUrl: null,
    createdAt: new Date('2026-03-04'),
    updatedAt: new Date('2026-03-04'),
  };

  beforeEach(() => {
    prisma = {
      consent: {
        create: jest
          .fn()
          .mockImplementation((args) => Promise.resolve({ ...mockConsent, ...args.data })),
      },
      privacyRequest: {
        create: jest.fn().mockImplementation((args) =>
          Promise.resolve({
            ...mockPrivacyRequest,
            requestType: args.data.requestType,
            status: args.data.status,
          }),
        ),
        findMany: jest.fn().mockResolvedValue([mockPrivacyRequest]),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    service = new PrivacyService(prisma as unknown as PrismaService);
  });

  describe('consent creation', () => {
    it('should store consent with version and type correctly', async () => {
      const result = await service.createConsent('user-uuid', {
        consentType: 'analytics',
        version: '2.0',
        accepted: true,
      });

      expect(result.consentType).toBe('analytics');
      expect(result.version).toBe('2.0');
      expect(prisma.consent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-uuid',
          consentType: 'analytics',
          version: '2.0',
          accepted: true,
        }),
      });
    });

    it('should store all consent types', async () => {
      for (const type of ['health_data', 'marketing', 'analytics'] as const) {
        await service.createConsent('user-uuid', {
          consentType: type,
          version: '1.0',
          accepted: true,
        });
        expect(prisma.consent.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ consentType: type }),
          }),
        );
      }
    });
  });

  describe('privacy requests', () => {
    it('should create data export request with pending status', async () => {
      const result = await service.requestDataExport('user-uuid');

      expect(result.requestType).toBe('export');
      expect(result.status).toBe('pending');
      expect(prisma.privacyRequest.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-uuid',
          requestType: 'export',
          status: 'pending',
        },
      });
    });

    it('should create account deletion request with pending status', async () => {
      const result = await service.requestAccountDeletion('user-uuid');

      expect(result.requestType).toBe('deletion');
      expect(result.status).toBe('pending');
      expect(prisma.privacyRequest.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-uuid',
          requestType: 'deletion',
          status: 'pending',
        },
      });
    });
  });
});
