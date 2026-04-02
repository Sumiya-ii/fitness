import { createHmac } from 'crypto';
import { Queue } from 'bullmq';
import { PrivacyService } from './privacy.service';
import { PrismaService } from '../prisma';

function hashIp(ip: string): string {
  return createHmac('sha256', process.env.IP_HASH_SECRET!).update(ip).digest('hex');
}

describe('PrivacyService', () => {
  let service: PrivacyService;
  let prisma: Record<string, Record<string, jest.Mock>>;
  let originalEnv: NodeJS.ProcessEnv;

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
    originalEnv = { ...process.env };
    process.env.IP_HASH_SECRET = 'test-secret';
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
    const mockQueue = { add: jest.fn().mockResolvedValue({ id: 'job-id' }) } as unknown as Queue;
    service = new PrivacyService(mockQueue, prisma as unknown as PrismaService);
  });

  afterEach(() => {
    process.env = originalEnv;
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

    it('should hash the IP address before storing', async () => {
      const rawIp = '192.168.1.1';
      await service.createConsent('user-uuid', {
        consentType: 'analytics',
        version: '2.0',
        accepted: true,
        ipAddress: rawIp,
      });

      const callArg = prisma.consent.create.mock.calls[0][0];
      expect(callArg.data.ipAddress).toBe(hashIp(rawIp));
      expect(callArg.data.ipAddress).not.toBe(rawIp);
    });

    it('should store null when no IP address is provided', async () => {
      await service.createConsent('user-uuid', {
        consentType: 'analytics',
        version: '2.0',
        accepted: true,
      });

      const callArg = prisma.consent.create.mock.calls[0][0];
      expect(callArg.data.ipAddress).toBeNull();
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
