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
    it('should return draft status when job exists', async () => {
      const mockJob = {
        id: 'job-456',
        data: { userId: 'user-1', reference: 'user/user-1/123-meal.jpg' },
        getState: jest.fn().mockResolvedValue('completed'),
      };
      mockQueue.getJob.mockResolvedValue(mockJob);

      const result = await service.getDraft('job-456', 'user-1');

      expect(result).toEqual({
        id: 'job-456',
        status: 'completed',
        reference: 'user/user-1/123-meal.jpg',
      });
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
