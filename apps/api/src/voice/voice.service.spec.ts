import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { VoiceService } from './voice.service';
import { QUEUE_NAMES } from '@coach/shared';

describe('VoiceService', () => {
  let service: VoiceService;
  let mockQueue: {
    add: jest.Mock;
    getJob: jest.Mock;
  };

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-123' }),
      getJob: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoiceService,
        {
          provide: getQueueToken(QUEUE_NAMES.STT_PROCESSING),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<VoiceService>(VoiceService);
  });

  describe('uploadAudio', () => {
    it('should enqueue STT job and return draft ID', async () => {
      const result = await service.uploadAudio(
        'user-1',
        Buffer.from('audio-data'),
        'en-US',
      );

      expect(result.draftId).toBe('job-123');
      expect(mockQueue.add).toHaveBeenCalledWith(
        'transcribe',
        expect.objectContaining({
          userId: 'user-1',
          locale: 'en-US',
        }),
      );
      expect(mockQueue.add.mock.calls[0][1].audioBuffer).toBeDefined();
    });
  });

  describe('getDraft', () => {
    it('should return draft status when job exists', async () => {
      const mockJob = {
        id: 'job-123',
        data: { userId: 'user-1' },
        getState: jest.fn().mockResolvedValue('completed'),
        returnvalue: { text: 'transcribed text' },
      };
      mockQueue.getJob.mockResolvedValue(mockJob);

      const result = await service.getDraft('job-123', 'user-1');

      expect(result).toEqual({
        id: 'job-123',
        status: 'completed',
        transcription: 'transcribed text',
      });
    });

    it('should throw when draft not found', async () => {
      mockQueue.getJob.mockResolvedValue(null);

      await expect(service.getDraft('missing', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw when draft belongs to different user', async () => {
      const mockJob = {
        id: 'job-123',
        data: { userId: 'other-user' },
        getState: jest.fn(),
      };
      mockQueue.getJob.mockResolvedValue(mockJob);

      await expect(service.getDraft('job-123', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
