import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '@coach/shared';

export interface VoiceDraftStatus {
  id: string;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  transcription?: string;
}

@Injectable()
export class VoiceService {
  constructor(
    @InjectQueue(QUEUE_NAMES.STT_PROCESSING) private readonly sttQueue: Queue,
  ) {}

  async uploadAudio(
    userId: string,
    audioBuffer: Buffer,
    locale?: string,
  ): Promise<{ draftId: string }> {
    const job = await this.sttQueue.add(
      'transcribe',
      { userId, audioBuffer: audioBuffer.toString('base64'), locale },
    );
    return { draftId: String(job.id!) };
  }

  async getDraft(draftId: string, userId: string): Promise<VoiceDraftStatus> {
    const job = await this.sttQueue.getJob(draftId);
    if (!job) {
      throw new NotFoundException('Draft not found');
    }
    const jobUserId = (job.data as { userId?: string }).userId;
    if (jobUserId !== userId) {
      throw new NotFoundException('Draft not found');
    }
    const state = await job.getState();
    const result: VoiceDraftStatus = {
      id: draftId,
      status: state as VoiceDraftStatus['status'],
    };
    if (state === 'completed' && job.returnvalue) {
      result.transcription = typeof job.returnvalue === 'string'
        ? job.returnvalue
        : (job.returnvalue as { text?: string })?.text;
    }
    return result;
  }
}
