import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { PhotosService } from './photos.service';
import { QUEUE_NAMES } from '@coach/shared';

describe('PhotosService', () => {
  let service: PhotosService;
  let mockQueue: {
    add: jest.Mock;
    getJob: jest.Mock;
  };

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-456' }),
      getJob: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PhotosService,
        {
          provide: getQueueToken(QUEUE_NAMES.PHOTO_PARSING),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<PhotosService>(PhotosService);
  });

  describe('uploadPhoto', () => {
    it('should enqueue photo parsing job and return draft ID', async () => {
      const result = await service.uploadPhoto('user-1', Buffer.from('image-data'), 'meal.jpg');

      expect(result.draftId).toBe('job-456');
      expect(mockQueue.add).toHaveBeenCalledWith(
        'parse',
        expect.objectContaining({
          userId: 'user-1',
          reference: expect.stringContaining('user/user-1/'),
        }),
      );
      expect(mockQueue.add.mock.calls[0][1].photoBuffer).toBeDefined();
    });
  });

  describe('getDraft', () => {
    it('should return draft status for waiting job', async () => {
      const mockJob = {
        id: 'job-456',
        data: { userId: 'user-1', reference: 'user/user-1/123-meal.jpg' },
        getState: jest.fn().mockResolvedValue('waiting'),
        returnvalue: null,
      };
      mockQueue.getJob.mockResolvedValue(mockJob);

      const result = await service.getDraft('job-456', 'user-1');

      expect(result).toEqual({
        id: 'job-456',
        status: 'waiting',
        reference: 'user/user-1/123-meal.jpg',
      });
    });

    it('should return full result including confidence fields for completed job', async () => {
      const mockJob = {
        id: 'job-456',
        data: { userId: 'user-1', reference: 'user/user-1/123-meal.jpg' },
        getState: jest.fn().mockResolvedValue('completed'),
        returnvalue: {
          mealName: 'Бууз',
          items: [],
          totalCalories: 320,
          totalProtein: 18,
          totalCarbs: 30,
          totalFat: 10,
          totalFiber: 2,
          totalSugar: 1,
          totalSodium: 400,
          totalSaturatedFat: 3,
          confidenceLevel: 'high',
          requiresClarification: false,
          clarificationQuestions: undefined,
        },
      };
      mockQueue.getJob.mockResolvedValue(mockJob);

      const result = await service.getDraft('job-456', 'user-1');

      expect(result.status).toBe('completed');
      expect(result.mealName).toBe('Бууз');
      expect(result.totalCalories).toBe(320);
      expect(result.confidenceLevel).toBe('high');
      expect(result.requiresClarification).toBe(false);
      expect(result.clarificationQuestions).toBeUndefined();
    });

    it('should propagate clarification questions when present', async () => {
      const questions = [{ id: 'q1', text: 'How many pieces?', type: 'count' as const }];
      const mockJob = {
        id: 'job-789',
        data: { userId: 'user-1', reference: 'user/user-1/456-meal.jpg' },
        getState: jest.fn().mockResolvedValue('completed'),
        returnvalue: {
          mealName: 'Unknown meal',
          items: [],
          totalCalories: 0,
          totalProtein: 0,
          totalCarbs: 0,
          totalFat: 0,
          totalFiber: 0,
          totalSugar: 0,
          totalSodium: 0,
          totalSaturatedFat: 0,
          confidenceLevel: 'low',
          requiresClarification: true,
          clarificationQuestions: questions,
        },
      };
      mockQueue.getJob.mockResolvedValue(mockJob);

      const result = await service.getDraft('job-789', 'user-1');

      expect(result.confidenceLevel).toBe('low');
      expect(result.requiresClarification).toBe(true);
      expect(result.clarificationQuestions).toEqual(questions);
    });

    it('should not include confidence fields for non-completed job', async () => {
      const mockJob = {
        id: 'job-456',
        data: { userId: 'user-1' },
        getState: jest.fn().mockResolvedValue('active'),
        returnvalue: null,
      };
      mockQueue.getJob.mockResolvedValue(mockJob);

      const result = await service.getDraft('job-456', 'user-1');

      expect(result.status).toBe('active');
      expect(result.confidenceLevel).toBeUndefined();
      expect(result.requiresClarification).toBeUndefined();
      expect(result.clarificationQuestions).toBeUndefined();
    });

    it('should throw when draft not found', async () => {
      mockQueue.getJob.mockResolvedValue(null);

      await expect(service.getDraft('missing', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw when draft belongs to different user', async () => {
      const mockJob = {
        id: 'job-456',
        data: { userId: 'other-user' },
        getState: jest.fn(),
      };
      mockQueue.getJob.mockResolvedValue(mockJob);

      await expect(service.getDraft('job-456', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });
});
