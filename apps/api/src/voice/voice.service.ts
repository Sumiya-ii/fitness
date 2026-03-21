import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '@coach/shared';
import { PrismaService } from '../prisma';
import { S3Service } from '../storage';

interface ParsedFoodItem {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface VoiceDraftStatus {
  id: string;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  transcription?: string;
  mealType?: string | null;
  items?: ParsedFoodItem[];
  totalCalories?: number;
  totalProtein?: number;
  totalCarbs?: number;
  totalFat?: number;
  errorMessage?: string;
}

const DRAFT_TTL_DAYS = 7;

@Injectable()
export class VoiceService {
  constructor(
    @InjectQueue(QUEUE_NAMES.STT_PROCESSING) private readonly sttQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  async uploadAudio(
    userId: string,
    audioBuffer: Buffer,
    locale?: string,
  ): Promise<{ draftId: string }> {
    const expiresAt = new Date(Date.now() + DRAFT_TTL_DAYS * 24 * 60 * 60 * 1000);

    // Create VoiceDraft row to persist state beyond BullMQ job lifetime
    const draft = await this.prisma.voiceDraft.create({
      data: {
        userId,
        locale: locale ?? 'mn',
        status: 'waiting',
        expiresAt,
      },
    });

    // Upload audio to S3 when configured; fall back to base64-in-job for local dev
    let s3Key: string | undefined;
    if (this.s3.isConfigured) {
      s3Key = `voice/${userId}/${draft.id}.m4a`;
      await this.s3.upload(s3Key, audioBuffer, 'audio/m4a');
      await this.prisma.voiceDraft.update({
        where: { id: draft.id },
        data: { s3Key },
      });
    }

    const job = await this.sttQueue.add('transcribe', {
      draftId: draft.id,
      userId,
      locale: locale ?? 'mn',
      s3Key,
      // Only include base64 as fallback when S3 is not available (local dev)
      ...(s3Key ? {} : { audioBuffer: audioBuffer.toString('base64') }),
    });

    await this.prisma.voiceDraft.update({
      where: { id: draft.id },
      data: { jobId: String(job.id!) },
    });

    return { draftId: draft.id };
  }

  async getDraft(draftId: string, userId: string): Promise<VoiceDraftStatus> {
    const draft = await this.prisma.voiceDraft.findFirst({
      where: { id: draftId, userId },
    });

    if (!draft) {
      throw new NotFoundException('Draft not found');
    }

    // Terminal states: return from DB directly (no BullMQ needed)
    if (draft.status === 'completed') {
      return {
        id: draft.id,
        status: 'completed',
        transcription: draft.transcription ?? undefined,
        mealType: draft.mealType ?? null,
        items: (draft.parsedItems as ParsedFoodItem[] | null) ?? undefined,
        totalCalories: draft.totalCalories ?? undefined,
        totalProtein: draft.totalProtein ?? undefined,
        totalCarbs: draft.totalCarbs ?? undefined,
        totalFat: draft.totalFat ?? undefined,
      };
    }

    if (draft.status === 'failed') {
      return {
        id: draft.id,
        status: 'failed',
        errorMessage: draft.errorMessage ?? undefined,
      };
    }

    // Non-terminal: check BullMQ for the live state
    if (draft.jobId) {
      const job = await this.sttQueue.getJob(draft.jobId);
      if (job) {
        const state = await job.getState();
        return { id: draft.id, status: state as VoiceDraftStatus['status'] };
      }
    }

    return { id: draft.id, status: draft.status as VoiceDraftStatus['status'] };
  }
}
