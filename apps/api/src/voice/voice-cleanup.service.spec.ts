import { Test, TestingModule } from '@nestjs/testing';
import { VoiceCleanupService } from './voice-cleanup.service';
import { PrismaService } from '../prisma';
import { SentryProvider } from '../observability';

describe('VoiceCleanupService', () => {
  let service: VoiceCleanupService;
  let mockPrisma: { voiceDraft: { deleteMany: jest.Mock } };
  let mockSentry: { captureException: jest.Mock };

  beforeEach(async () => {
    mockPrisma = {
      voiceDraft: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    mockSentry = { captureException: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoiceCleanupService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SentryProvider, useValue: mockSentry },
      ],
    }).compile();

    service = module.get<VoiceCleanupService>(VoiceCleanupService);
  });

  describe('deleteExpiredDrafts', () => {
    it('calls prisma.voiceDraft.deleteMany with lt: approximately now', async () => {
      const before = new Date();
      await service.deleteExpiredDrafts();
      const after = new Date();

      expect(mockPrisma.voiceDraft.deleteMany).toHaveBeenCalledTimes(1);
      const { where } = mockPrisma.voiceDraft.deleteMany.mock.calls[0][0];
      expect(where.expiresAt.lt).toBeInstanceOf(Date);
      expect(where.expiresAt.lt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(where.expiresAt.lt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('does not throw or log when count is 0', async () => {
      mockPrisma.voiceDraft.deleteMany.mockResolvedValue({ count: 0 });
      await expect(service.deleteExpiredDrafts()).resolves.toBeUndefined();
      expect(mockSentry.captureException).not.toHaveBeenCalled();
    });

    it('swallows errors and calls sentry.captureException', async () => {
      const err = new Error('DB connection lost');
      mockPrisma.voiceDraft.deleteMany.mockRejectedValue(err);

      await expect(service.deleteExpiredDrafts()).resolves.toBeUndefined();
      expect(mockSentry.captureException).toHaveBeenCalledWith(err);
    });
  });
});
