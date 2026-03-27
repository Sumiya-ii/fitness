import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '../config';
import OpenAI from 'openai';
import { toFile } from 'openai/uploads';
import Redis from 'ioredis';
import { TELEGRAM_FOOD_PARSER_PROMPT } from '@coach/shared';

export interface ParsedFoodItem {
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: number;
}

export interface TelegramFoodParseResult {
  isFoodLog: boolean;
  items: ParsedFoodItem[];
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' | null;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

export interface TelegramDraft extends TelegramFoodParseResult {
  originalText: string;
}

const DRAFT_TTL_SECONDS = 600; // 10 minutes
const DRAFT_KEY_PREFIX = 'tg:draft:';

@Injectable()
export class TelegramFoodParserService implements OnModuleDestroy {
  private readonly logger = new Logger(TelegramFoodParserService.name);
  private readonly openai: OpenAI | null = null;
  private readonly redis: Redis;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
    this.redis = new Redis(this.config.get('REDIS_URL'));
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }

  async parse(text: string): Promise<TelegramFoodParseResult> {
    const empty: TelegramFoodParseResult = {
      isFoodLog: false,
      items: [],
      mealType: null,
      totalCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
    };

    if (!this.openai) {
      this.logger.warn('OPENAI_API_KEY not set — food parsing disabled');
      return empty;
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: TELEGRAM_FOOD_PARSER_PROMPT },
          { role: 'user', content: text },
        ],
        max_tokens: 800,
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(content) as {
        isFoodLog?: boolean;
        mealType?: string | null;
        items?: Array<{
          name?: string;
          quantity?: number;
          unit?: string;
          calories?: number;
          protein?: number;
          carbs?: number;
          fat?: number;
          confidence?: number;
        }>;
      };

      if (!parsed.isFoodLog) return empty;

      const items: ParsedFoodItem[] = (parsed.items ?? []).map((item) => ({
        name: item.name ?? 'Unknown food',
        quantity: item.quantity ?? 1,
        unit: item.unit ?? 'serving',
        calories: Math.max(0, Math.round(item.calories ?? 0)),
        protein: Math.max(0, Number((item.protein ?? 0).toFixed(1))),
        carbs: Math.max(0, Number((item.carbs ?? 0).toFixed(1))),
        fat: Math.max(0, Number((item.fat ?? 0).toFixed(1))),
        confidence: Math.min(1, Math.max(0, item.confidence ?? 0.7)),
      }));

      const validMealTypes = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
      const mealType = validMealTypes.includes(parsed.mealType as (typeof validMealTypes)[number])
        ? (parsed.mealType as 'breakfast' | 'lunch' | 'dinner' | 'snack')
        : null;

      return {
        isFoodLog: true,
        items,
        mealType,
        totalCalories: Math.round(items.reduce((s, i) => s + i.calories, 0)),
        totalProtein: Number(items.reduce((s, i) => s + i.protein, 0).toFixed(1)),
        totalCarbs: Number(items.reduce((s, i) => s + i.carbs, 0).toFixed(1)),
        totalFat: Number(items.reduce((s, i) => s + i.fat, 0).toFixed(1)),
      };
    } catch (err) {
      this.logger.error(
        'Food parsing failed — falling back to chat',
        err instanceof Error ? err.message : String(err),
      );
      return empty;
    }
  }

  /**
   * Transcribe a voice audio buffer using OpenAI Whisper.
   * Supports Mongolian and English — Whisper auto-detects language.
   * Returns the transcribed text, or empty string if transcription fails.
   */
  async transcribeVoice(audioBuffer: Buffer): Promise<string> {
    if (!this.openai) {
      this.logger.warn('OPENAI_API_KEY not set — voice transcription disabled');
      return '';
    }

    try {
      // Telegram voice messages are OGG/Opus (.oga)
      const audioFile = await toFile(audioBuffer, 'voice.oga', { type: 'audio/ogg' });
      const transcription = await this.openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        // No language hint — Whisper auto-detects MN/EN reliably
      });
      return transcription.text.trim();
    } catch (err) {
      this.logger.error(
        'Voice transcription failed',
        err instanceof Error ? err.message : String(err),
      );
      return '';
    }
  }

  async saveDraft(telegramUserId: number, draft: TelegramDraft): Promise<void> {
    await this.redis.set(
      `${DRAFT_KEY_PREFIX}${telegramUserId}`,
      JSON.stringify(draft),
      'EX',
      DRAFT_TTL_SECONDS,
    );
  }

  async getDraft(telegramUserId: number): Promise<TelegramDraft | null> {
    const raw = await this.redis.get(`${DRAFT_KEY_PREFIX}${telegramUserId}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as TelegramDraft;
    } catch {
      return null;
    }
  }

  async deleteDraft(telegramUserId: number): Promise<void> {
    await this.redis.del(`${DRAFT_KEY_PREFIX}${telegramUserId}`);
  }
}
