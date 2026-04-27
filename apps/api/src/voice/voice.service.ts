import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as Sentry from '@sentry/node';
import { QUEUE_NAMES } from '@coach/shared';
import { PrismaService } from '../prisma';
import { S3Service } from '../storage';
import { VoiceRateLimitService } from './voice-rate-limit.service';

interface ParsedFoodItem {
  name: string;
  quantity?: number;
  unit?: string;
  grams?: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  saturatedFat?: number;
  confidence?: number;
  ambiguity?: string | null;
  missing?: string[];
}

interface ClarificationOption {
  label: string;
  patch: Record<string, unknown> | null;
}

interface Clarification {
  question: string;
  options: ClarificationOption[];
  itemIndex: number | null;
  reason: string;
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
  totalSugar?: number | null;
  totalSodium?: number | null;
  totalSaturatedFat?: number | null;
  clarification?: Clarification;
  errorMessage?: string;
}

/**
 * The worker writes parsed_items as either a bare array (legacy) or as the
 * envelope { items, clarification? }. This unwraps both shapes.
 */
function unwrapParsedItems(raw: unknown): {
  items: ParsedFoodItem[] | undefined;
  clarification: Clarification | undefined;
} {
  if (raw == null) return { items: undefined, clarification: undefined };
  if (Array.isArray(raw)) return { items: raw as ParsedFoodItem[], clarification: undefined };
  if (typeof raw === 'object') {
    const env = raw as { items?: unknown; clarification?: unknown };
    const items = Array.isArray(env.items) ? (env.items as ParsedFoodItem[]) : undefined;
    const clarification =
      env.clarification && typeof env.clarification === 'object'
        ? (env.clarification as Clarification)
        : undefined;
    return { items, clarification };
  }
  return { items: undefined, clarification: undefined };
}

const DRAFT_TTL_DAYS = 7;

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.STT_PROCESSING) private readonly sttQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly rateLimit: VoiceRateLimitService,
  ) {}

  async uploadAudio(
    userId: string,
    audioBuffer: Buffer,
    locale?: string,
  ): Promise<{ draftId: string }> {
    const { allowed } = await this.rateLimit.incrementAndCheck(userId);
    if (!allowed) {
      throw new BadRequestException('voice_daily_cap_reached');
    }

    const expiresAt = new Date(Date.now() + DRAFT_TTL_DAYS * 24 * 60 * 60 * 1000);

    // Create VoiceDraft row to persist state beyond BullMQ job lifetime
    let draft: { id: string };
    try {
      draft = await this.prisma.voiceDraft.create({
        data: {
          userId,
          locale: locale ?? 'mn',
          status: 'waiting',
          expiresAt,
        },
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to create voice draft: ${msg}`);
      Sentry.captureException(error, { tags: { service: 'voice', stage: 'create_draft' } });
      if (msg.includes("doesn't exist") || msg.includes('does not exist')) {
        throw new InternalServerErrorException(
          'Voice drafts table is not available. Please run database migrations.',
        );
      }
      throw new InternalServerErrorException('Failed to create voice draft');
    }

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

    const job = await this.sttQueue.add(
      'transcribe',
      {
        draftId: draft.id,
        userId,
        locale: locale ?? 'mn',
        s3Key,
        // Only include base64 as fallback when S3 is not available (local dev)
        ...(s3Key ? {} : { audioBuffer: audioBuffer.toString('base64') }),
      },
      {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 86400 },
        removeOnFail: { age: 604800 },
      },
    );

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
      const { items, clarification } = unwrapParsedItems(draft.parsedItems);
      return {
        id: draft.id,
        status: 'completed',
        transcription: draft.transcription ?? undefined,
        mealType: draft.mealType ?? null,
        items,
        totalCalories: draft.totalCalories != null ? Number(draft.totalCalories) : undefined,
        totalProtein: draft.totalProtein != null ? Number(draft.totalProtein) : undefined,
        totalCarbs: draft.totalCarbs != null ? Number(draft.totalCarbs) : undefined,
        totalFat: draft.totalFat != null ? Number(draft.totalFat) : undefined,
        totalSugar: draft.totalSugar != null ? Number(draft.totalSugar) : undefined,
        totalSodium: draft.totalSodium != null ? Number(draft.totalSodium) : undefined,
        totalSaturatedFat:
          draft.totalSaturatedFat != null ? Number(draft.totalSaturatedFat) : undefined,
        clarification,
        // errorMessage on a completed draft is a non-fatal warning (e.g. parse failed)
        errorMessage: draft.errorMessage ?? undefined,
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
