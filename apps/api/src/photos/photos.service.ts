import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '@coach/shared';
import type { ParsedFoodItem } from './photo-parser.service';

export interface PhotoDraftStatus {
  id: string;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  reference?: string;
  mealName?: string;
  items?: ParsedFoodItem[];
  totalCalories?: number;
  totalProtein?: number;
  totalCarbs?: number;
  totalFat?: number;
  totalFiber?: number;
  totalSugar?: number;
  totalSodium?: number;
  totalSaturatedFat?: number;
}

@Injectable()
export class PhotosService {
  constructor(@InjectQueue(QUEUE_NAMES.PHOTO_PARSING) private readonly photoQueue: Queue) {}

  async uploadPhoto(
    userId: string,
    photoBuffer: Buffer,
    originalName?: string,
    mode?: 'food' | 'label',
  ): Promise<{ draftId: string }> {
    const reference = `user/${userId}/${Date.now()}-${originalName ?? 'photo'}`;
    const job = await this.photoQueue.add('parse', {
      userId,
      reference,
      photoBuffer: photoBuffer.toString('base64'),
      ...(mode && { mode }),
    });
    return { draftId: String(job.id!) };
  }

  async getDraft(draftId: string, userId: string): Promise<PhotoDraftStatus> {
    const job = await this.photoQueue.getJob(draftId);
    if (!job) {
      throw new NotFoundException('Draft not found');
    }
    const jobUserId = (job.data as { userId?: string }).userId;
    if (jobUserId !== userId) {
      throw new NotFoundException('Draft not found');
    }
    const state = await job.getState();
    const result: PhotoDraftStatus = {
      id: draftId,
      status: state as PhotoDraftStatus['status'],
    };
    const reference = (job.data as { reference?: string }).reference;
    if (reference) {
      result.reference = reference;
    }

    if (state === 'completed' && job.returnvalue) {
      const parsed = job.returnvalue as {
        mealName?: string;
        items?: ParsedFoodItem[];
        totalCalories?: number;
        totalProtein?: number;
        totalCarbs?: number;
        totalFat?: number;
        totalFiber?: number;
        totalSugar?: number;
        totalSodium?: number;
        totalSaturatedFat?: number;
      };
      result.mealName = parsed.mealName;
      result.items = parsed.items;
      result.totalCalories = parsed.totalCalories;
      result.totalProtein = parsed.totalProtein;
      result.totalCarbs = parsed.totalCarbs;
      result.totalFat = parsed.totalFat;
      result.totalFiber = parsed.totalFiber;
      result.totalSugar = parsed.totalSugar;
      result.totalSodium = parsed.totalSodium;
      result.totalSaturatedFat = parsed.totalSaturatedFat;
    }

    return result;
  }
}
