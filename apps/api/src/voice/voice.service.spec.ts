import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { VoiceService } from './voice.service';
import { PrismaService } from '../prisma';
import { S3Service } from '../storage';
import { VoiceRateLimitService } from './voice-rate-limit.service';
import { QUEUE_NAMES } from '@coach/shared';

describe('VoiceService', () => {
  let service: VoiceService;
  let mockQueue: { add: jest.Mock; getJob: jest.Mock };
  let mockPrisma: { voiceDraft: { create: jest.Mock; update: jest.Mock; findFirst: jest.Mock } };
  let mockS3: { isConfigured: boolean; upload: jest.Mock };
  let mockRateLimit: { incrementAndCheck: jest.Mock };

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
    mockRateLimit = {
      incrementAndCheck: jest.fn().mockResolvedValue({ allowed: true, count: 1, limit: 30 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoiceService,
        { provide: getQueueToken(QUEUE_NAMES.STT_PROCESSING), useValue: mockQueue },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: S3Service, useValue: mockS3 },
        { provide: VoiceRateLimitService, useValue: mockRateLimit },
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
        expect.anything(),
      );
      // base64 audio included when S3 not configured
      expect(mockQueue.add.mock.calls[0][1].audioBuffer).toBeDefined();
    });

    it('should throw InternalServerErrorException when voice_drafts table does not exist', async () => {
      mockPrisma.voiceDraft.create.mockRejectedValue(
        new Error(
          "Invalid `prisma.voiceDraft.create()` invocation: The table `public.voice_drafts` doesn't exist in the current database.",
        ),
      );

      await expect(service.uploadAudio('user-1', Buffer.from('audio'), 'mn')).rejects.toThrow(
        InternalServerErrorException,
      );

      await expect(service.uploadAudio('user-1', Buffer.from('audio'), 'mn')).rejects.toThrow(
        'Voice drafts table is not available. Please run database migrations.',
      );
    });

    it('should throw InternalServerErrorException on unexpected Prisma errors', async () => {
      mockPrisma.voiceDraft.create.mockRejectedValue(new Error('Connection refused'));

      await expect(service.uploadAudio('user-1', Buffer.from('audio'), 'mn')).rejects.toThrow(
        InternalServerErrorException,
      );

      await expect(service.uploadAudio('user-1', Buffer.from('audio'), 'mn')).rejects.toThrow(
        'Failed to create voice draft',
      );
    });

    it('should upload to S3 when configured', async () => {
      mockS3.isConfigured = true;

      await service.uploadAudio('user-1', Buffer.from('audio-data'), 'en');

      expect(mockS3.upload).toHaveBeenCalledWith(
        'voice/user-1/draft-abc.m4a',
        Buffer.from('audio-data'),
        'audio/m4a',
      );
      // S3 key update + job ID update = 2 updates
      expect(mockPrisma.voiceDraft.update).toHaveBeenCalledTimes(2);
      // base64 should NOT be in the job payload when S3 is used
      expect(mockQueue.add.mock.calls[0][1].audioBuffer).toBeUndefined();
      // BullMQ options must include retry config
      expect(mockQueue.add.mock.calls[0][2]).toMatchObject({
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 86400 },
        removeOnFail: { age: 604800 },
      });
    });

    it('throws BadRequestException with voice_daily_cap_reached when rate limit exceeded', async () => {
      mockRateLimit.incrementAndCheck.mockResolvedValue({ allowed: false, count: 31, limit: 30 });

      await expect(service.uploadAudio('user-1', Buffer.from('audio'), 'mn')).rejects.toThrow(
        new BadRequestException('voice_daily_cap_reached'),
      );
      expect(mockPrisma.voiceDraft.create).not.toHaveBeenCalled();
      expect(mockS3.upload).not.toHaveBeenCalled();
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('should default locale to mn when not provided', async () => {
      await service.uploadAudio('user-1', Buffer.from('audio'));

      expect(mockPrisma.voiceDraft.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ locale: 'mn' }),
        }),
      );
      expect(mockQueue.add).toHaveBeenCalledWith(
        'transcribe',
        expect.objectContaining({ locale: 'mn' }),
        expect.anything(),
      );
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

    it('should return failed status with error message', async () => {
      mockPrisma.voiceDraft.findFirst.mockResolvedValue({
        id: 'draft-abc',
        status: 'failed',
        errorMessage: 'Transcription timeout',
        jobId: 'job-123',
        transcription: null,
        mealType: null,
        parsedItems: null,
        totalCalories: null,
        totalProtein: null,
        totalCarbs: null,
        totalFat: null,
      });

      const result = await service.getDraft('draft-abc', 'user-1');

      expect(result.status).toBe('failed');
      expect(result.errorMessage).toBe('Transcription timeout');
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

    it('unwraps the { items, clarification } envelope from parsed_items', async () => {
      const envelope = {
        items: [
          {
            name: 'Бууз',
            quantity: 4,
            unit: 'piece',
            grams: 200,
            calories: 360,
            protein: 28,
            carbs: 24,
            fat: 16,
            confidence: 0.8,
            ambiguity: 'meat_type',
          },
        ],
        clarification: {
          question: 'Хуушуур юутай байсан бэ?',
          options: [
            { label: 'Үхрийн мах', patch: { name: 'Хуушуур (үхэр)' } },
            { label: 'Алгасах', patch: null },
          ],
          itemIndex: 0,
          reason: 'meat_type_ambiguous',
        },
      };
      mockPrisma.voiceDraft.findFirst.mockResolvedValue({
        id: 'draft-abc',
        status: 'completed',
        transcription: 'хуушуур идлээ',
        mealType: 'lunch',
        parsedItems: envelope,
        totalCalories: 360,
        totalProtein: 28,
        totalCarbs: 24,
        totalFat: 16,
        totalSugar: null,
        totalSodium: null,
        totalSaturatedFat: null,
        jobId: 'job-123',
        errorMessage: null,
      });

      const result = await service.getDraft('draft-abc', 'user-1');

      expect(result.items).toHaveLength(1);
      expect(result.items?.[0].name).toBe('Бууз');
      expect(result.clarification).toBeDefined();
      expect(result.clarification?.reason).toBe('meat_type_ambiguous');
      expect(result.clarification?.options).toHaveLength(2);
    });

    it('handles legacy bare-array parsed_items shape (backward compat)', async () => {
      mockPrisma.voiceDraft.findFirst.mockResolvedValue({
        id: 'draft-abc',
        status: 'completed',
        transcription: 'rice',
        mealType: 'lunch',
        parsedItems: [{ name: 'Rice', calories: 200, protein: 4, carbs: 45, fat: 0 }],
        totalCalories: 200,
        totalProtein: 4,
        totalCarbs: 45,
        totalFat: 0,
        totalSugar: null,
        totalSodium: null,
        totalSaturatedFat: null,
        jobId: 'job-123',
        errorMessage: null,
      });

      const result = await service.getDraft('draft-abc', 'user-1');

      expect(result.items).toHaveLength(1);
      expect(result.items?.[0].name).toBe('Rice');
      expect(result.clarification).toBeUndefined();
    });

    it('surfaces non-fatal errorMessage on completed draft (parse warning)', async () => {
      mockPrisma.voiceDraft.findFirst.mockResolvedValue({
        id: 'draft-abc',
        status: 'completed',
        transcription: 'би хоол идлээ',
        mealType: null,
        parsedItems: { items: [] },
        totalCalories: 0,
        totalProtein: 0,
        totalCarbs: 0,
        totalFat: 0,
        totalSugar: null,
        totalSodium: null,
        totalSaturatedFat: null,
        jobId: 'job-123',
        errorMessage: 'Nutrition parse failed: 503',
      });

      const result = await service.getDraft('draft-abc', 'user-1');

      expect(result.status).toBe('completed');
      expect(result.errorMessage).toContain('Nutrition parse failed');
      expect(result.items).toEqual([]);
    });

    it('should check BullMQ job state for non-terminal draft with jobId', async () => {
      mockPrisma.voiceDraft.findFirst.mockResolvedValue({
        id: 'draft-abc',
        status: 'waiting',
        jobId: 'job-123',
        transcription: null,
        mealType: null,
        parsedItems: null,
        totalCalories: null,
        totalProtein: null,
        totalCarbs: null,
        totalFat: null,
        errorMessage: null,
      });
      mockQueue.getJob.mockResolvedValue({ getState: jest.fn().mockResolvedValue('active') });

      const result = await service.getDraft('draft-abc', 'user-1');

      expect(result.status).toBe('active');
      expect(mockQueue.getJob).toHaveBeenCalledWith('job-123');
    });
  });
});
