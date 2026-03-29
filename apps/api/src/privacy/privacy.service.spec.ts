import { PrivacyService } from './privacy.service';
import { PrismaService } from '../prisma';

describe('PrivacyService', () => {
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
          }),
        ),
        findMany: jest.fn().mockResolvedValue([mockPrivacyRequest]),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    service = new PrivacyService(prisma as unknown as PrismaService);
  });

  describe('createConsent', () => {
    it('should create consent record with version and type', async () => {
      const result = await service.createConsent('user-uuid', {
        consentType: 'analytics',
        version: '2.0',
        accepted: true,
      });

      expect(result.consentType).toBe('analytics');
      expect(result.version).toBe('2.0');
      expect(result.accepted).toBe(true);
      expect(prisma.consent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-uuid',
          consentType: 'analytics',
          version: '2.0',
          accepted: true,
        }),
      });
    });
  });

  describe('requestDataExport', () => {
    it('should create export request with pending status', async () => {
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
  });

  describe('requestAccountDeletion', () => {
    it('should create deletion request with pending status', async () => {
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

  describe('getRequests', () => {
    it('should return paginated privacy requests', async () => {
      const result = await service.getRequests('user-uuid', {
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].requestType).toBe('export');
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
    });
  });
});
