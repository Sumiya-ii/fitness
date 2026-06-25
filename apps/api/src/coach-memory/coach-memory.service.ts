import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma';
import { QUEUE_NAMES } from '@coach/shared';

export interface CoachMemoryJobData {
  userId: string;
  locale: string;
}

@Injectable()
export class CoachMemoryService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.COACH_MEMORY) private readonly queue: Queue,
  ) {}

  async listMemories(userId: string) {
    const memories = await this.prisma.coachMemory.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    return memories.map((m) => ({
      id: m.id,
      category: m.category,
      summary: m.summary,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    }));
  }

  async removeMemory(userId: string, id: string): Promise<void> {
    const memory = await this.prisma.coachMemory.findFirst({
      where: { id, userId },
    });
    if (!memory) {
      throw new NotFoundException('Memory not found');
    }
    await this.prisma.coachMemory.delete({ where: { id } });
  }

  /**
   * Returns a ≤500-token memory block string for injection into GPT system prompts.
   * Returns null if no memories exist for the user yet.
   */
  async getMemoryBlock(userId: string): Promise<string | null> {
    const memories = await this.prisma.coachMemory.findMany({ where: { userId } });
    if (!memories.length) return null;

    const categoryOrder = ['foods', 'patterns', 'goals', 'preferences'];
    const sorted = [...memories].sort(
      (a, b) => categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category),
    );

    const lines = sorted.map((m) => {
      const label = m.category.charAt(0).toUpperCase() + m.category.slice(1);
      return `${label}: ${m.summary}`;
    });

    return `=== Coach memory (last 30 days) ===\n${lines.join('\n')}`;
  }

  /**
   * Enqueues one memory-refresh job per user. Called weekly by the cron.
   * Streams users in batches to avoid loading all onboarded users into memory at once.
   */
  async scheduleRefresh(): Promise<number> {
    const BATCH_SIZE = 200;
    let cursor: string | undefined;
    let enqueued = 0;
    let hasMore = true;

    while (hasMore) {
      const users = await this.prisma.user.findMany({
        where: {
          profile: {
            is: {
              onboardingCompletedAt: { not: null },
            },
          },
        },
        select: { id: true, profile: { select: { locale: true } } },
        orderBy: { id: 'asc' },
        take: BATCH_SIZE,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      });

      for (const user of users) {
        await this.enqueueForUser(user.id, user.profile?.locale ?? 'mn');
        enqueued++;
      }

      hasMore = users.length === BATCH_SIZE;
      if (hasMore) cursor = users[users.length - 1]!.id;
    }

    return enqueued;
  }

  /**
   * Enqueues a memory-refresh job for a single user.
   * Pass delayMs to schedule it in the future (e.g. 7 days after onboarding).
   * The stable jobId ensures Sunday cron + onboarding trigger never duplicate.
   */
  async enqueueForUser(userId: string, locale: string, delayMs?: number): Promise<void> {
    const jobData: CoachMemoryJobData = { userId, locale };
    await this.queue.add('refresh', jobData, {
      jobId: `coach-memory-${userId}`,
      delay: delayMs,
      // Keep completed job for 7 days so the next weekly run can re-enqueue
      removeOnComplete: { age: 60 * 60 * 24 * 7 },
    });
  }
}
