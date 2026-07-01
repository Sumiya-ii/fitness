import { Injectable, Logger, Inject } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { ConfigService } from '../config';
import { DashboardService } from '../dashboard/dashboard.service';
import { CoachMemoryService } from '../coach-memory/coach-memory.service';
import { PrismaService } from '../prisma';
import { REDIS } from '../redis';
import { toDateKeyInTZ } from '@coach/shared';
import OpenAI from 'openai';
import type Redis from 'ioredis';

const MAX_HISTORY = 40; // 20 conversation turns
const HISTORY_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const SYSTEM_PROMPT_BASE = `You are Coach, an AI nutrition and fitness coach for Mongolian users. You help users track their diet, reach their health goals, and answer nutrition and fitness questions.

You are friendly, encouraging, and knowledgeable. You can respond in both English and Mongolian — always match the language the user writes in.

When giving food advice, consider Mongolian cuisine (tsuivan, buuz, khuushuur, airag, etc.) and local eating habits where relevant.

Keep responses concise and practical. You can suggest specific foods to eat, help interpret nutrition data, and motivate users toward their goals.`;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly openai: OpenAI | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly dashboardService: DashboardService,
    private readonly coachMemory: CoachMemoryService,
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {
    const apiKey = this.config.get('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  private historyKey(userId: string): string {
    return `chat:history:${userId}`;
  }

  async getHistory(userId: string): Promise<ChatMessage[]> {
    const raw = await this.redis.get(this.historyKey(userId));
    if (!raw) return [];
    try {
      return JSON.parse(raw) as ChatMessage[];
    } catch {
      return [];
    }
  }

  async clearHistory(userId: string): Promise<void> {
    await this.redis.del(this.historyKey(userId));
  }

  async sendMessage(
    userId: string,
    userMessage: string,
  ): Promise<{ message: string; timestamp: string }> {
    const userTimestamp = new Date().toISOString();

    if (!this.openai) {
      return {
        message: 'AI coach is not available right now. Please try again later.',
        timestamp: userTimestamp,
      };
    }

    // Build nutrition context from today's dashboard. Resolve the user's
    // timezone first so "today" is their local calendar day, not UTC —
    // otherwise Mongolian users (UTC+8) see 0 meals after 08:00 local.
    let nutritionContext = 'User nutrition data is not available right now.';
    try {
      const profile = await this.prisma.profile.findUnique({
        where: { userId },
        select: { timezone: true },
      });
      const tz = profile?.timezone ?? undefined;
      const dateStr = toDateKeyInTZ(new Date(), tz);
      const dashboard = await this.dashboardService.getDailyDashboard(userId, dateStr, tz);
      if (dashboard.targets) {
        const { consumed, targets, remaining, mealCount } = dashboard;
        nutritionContext = [
          `Today's nutrition status:`,
          `- Calories: ${consumed.calories} / ${targets.calories} kcal (${remaining?.calories ?? 0} remaining)`,
          `- Protein: ${consumed.protein}g / ${targets.protein}g`,
          `- Carbs: ${consumed.carbs}g / ${targets.carbs}g`,
          `- Fat: ${consumed.fat}g / ${targets.fat}g`,
          `- Meals logged: ${mealCount}`,
        ].join('\n');
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { service: 'chat', stage: 'load_dashboard' } });
    }

    // Inject long-term coach memory if available
    let memoryBlock = '';
    try {
      const block = await this.coachMemory.getMemoryBlock(userId);
      if (block) {
        memoryBlock = `\n\n${block}`;
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { service: 'chat', stage: 'load_coach_memory' } });
    }

    const systemPrompt = `${SYSTEM_PROMPT_BASE}\n\n${nutritionContext}${memoryBlock}`;

    const history = await this.getHistory(userId);

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage },
    ];

    this.logger.debug(`Sending message to OpenAI, history length: ${history.length}`);
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      max_tokens: 600,
      temperature: 0.7,
    });

    const assistantContent =
      response.choices[0]?.message?.content ?? 'Sorry, I could not generate a response.';
    const assistantTimestamp = new Date().toISOString();

    const updatedHistory: ChatMessage[] = [
      ...history,
      { role: 'user' as const, content: userMessage, timestamp: userTimestamp },
      { role: 'assistant' as const, content: assistantContent, timestamp: assistantTimestamp },
    ].slice(-MAX_HISTORY);

    await this.redis.setex(
      this.historyKey(userId),
      HISTORY_TTL_SECONDS,
      JSON.stringify(updatedHistory),
    );

    return { message: assistantContent, timestamp: assistantTimestamp };
  }
}
