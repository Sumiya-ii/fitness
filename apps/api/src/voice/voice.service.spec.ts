import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { VoiceService } from './voice.service';
import { PrismaService } from '../prisma';
import { S3Service } from '../storage';
import { QUEUE_NAMES } from '@coach/shared';

describe('VoiceService', () => {
  let service: VoiceService;
  let mockQueue: { add: jest.Mock; getJob: jest.Mock };
  let mockPrisma: { voiceDraft: { create: jest.Mock; update: jest.Mock; findFirst: jest.Mock } };
  let mockS3: { isConfigured: boolean; upload: jest.Mock };

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-123' }),
      getJob: jest.fn(),
    };
    mockPrisma = {
      voiceDraft: {
        create: jest.fn().mockResolvedValue({ id: 'draft-abc' }),
        update: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn(),
      },
    };
    mockS3 = { isConfigured: false, upload: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoiceService,
        { provide: getQueueToken(QUEUE_NAMES.STT_PROCESSING), useValue: mockQueue },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: S3Service, useValue: mockS3 },
      ],
    }).compile();

    service = module.get<VoiceService>(VoiceService);
  });

  describe('uploadAudio', () => {
    it('should create a draft and enqueue STT job', async () => {
      const result = await service.uploadAudio('user-1', Buffer.from('audio-data'), 'en-US');

      // draftId comes from the Prisma-created draft, not the job id
      expect(result.draftId).toBe('draft-abc');
      expect(mockPrisma.voiceDraft.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: 'user-1' }) }),
      );
      expect(mockQueue.add).toHaveBeenCalledWith(
        'transcribe',
        expect.objectContaining({ userId: 'user-1', locale: 'en-US' }),
      );
      // base64 audio included when S3 not configured
      expect(mockQueue.add.mock.calls[0][1].audioBuffer).toBeDefined();
    });
  });

  describe('getDraft', () => {
    it('should return completed draft from DB', async () => {
      mockPrisma.voiceDraft.findFirst.mockResolvedValue({
        id: 'draft-abc',
        status: 'completed',
        transcription: 'transcribed text',
        mealType: 'lunch',
        parsedItems: [],
        totalCalories: 500,
        totalProtein: 30,
        totalCarbs: 60,
        totalFat: 10,
        jobId: 'job-123',
        errorMessage: null,
      });

      const result = await service.getDraft('draft-abc', 'user-1');

      expect(result.id).toBe('draft-abc');
      expect(result.status).toBe('completed');
      expect(result.transcription).toBe('transcribed text');
    });

    it('should throw when draft not found', async () => {
      mockPrisma.voiceDraft.findFirst.mockResolvedValue(null);

      await expect(service.getDraft('missing', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('should return waiting status for non-terminal draft without jobId', async () => {
      mockPrisma.voiceDraft.findFirst.mockResolvedValue({
        id: 'draft-abc',
        status: 'waiting',
        jobId: null,
        transcription: null,
        mealType: null,
        parsedItems: null,
        totalCalories: null,
        totalProtein: null,
        totalCarbs: null,
        totalFat: null,
        errorMessage: null,
      });

      const result = await service.getDraft('draft-abc', 'user-1');

      expect(result.status).toBe('waiting');
    });
  });
});
