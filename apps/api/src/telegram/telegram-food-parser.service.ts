import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '../config';
import OpenAI from 'openai';
import { toFile } from 'openai/uploads';
import Redis from 'ioredis';

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

// Comprehensive bilingual (MN/EN) food parser prompt
// Combines intent classification with nutrition extraction
const FOOD_PARSER_PROMPT = `You are a nutrition expert specializing in Mongolian and international cuisine. Your job is to determine if a user is logging food they ate, and if so, extract the food items with nutrition estimates.

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "isFoodLog": true,
  "mealType": "breakfast",
  "items": [
    {
      "name": "Food name (keep Mongolian script if written in Mongolian)",
      "quantity": 3,
      "unit": "piece",
      "calories": 270,
      "protein": 21.0,
      "carbs": 18.0,
      "fat": 12.0,
      "confidence": 0.9
    }
  ]
}

isFoodLog rules:
- true: user is reporting food they ate or are eating right now
  Examples: "3 буузт идлээ", "I ate rice and chicken", "цай уулаа", "just had pizza"
- false: user is asking a question, requesting advice, or chatting
  Examples: "маргааш юу идэх вэ?", "what should I eat?", "calories in an apple?", "сайн уу"

mealType rules:
- "breakfast": user mentions breakfast or morning context ("өглөөний хоол", "breakfast", "өглөө")
- "lunch": user mentions lunch or midday context ("өдрийн хоол", "lunch")
- "dinner": user mentions dinner or evening context ("оройн хоол", "dinner", "орой")
- "snack": user mentions snack ("зууш", "snack")
- null: no meal type mentioned or inferable

items rules:
- name: use the name as the user said it; keep Mongolian script for Mongolian food names
- quantity: numeric amount mentioned (e.g. 3 for "3 buurz"); default 1
- unit: one of "piece", "bowl", "cup", "plate", "slice", "glass", "can", "serving", "gram", "tbsp"
- calories/protein/carbs/fat: totals for the full quantity (NOT per 100g)
- confidence: 0.9-1.0 = specific quantity + well-known food | 0.7-0.8 = standard portion | 0.4-0.6 = vague

If isFoodLog is false, return empty items array and null mealType.

Mongolian foods reference (approximate nutrition per standard serving):
Traditional meat dishes:
- буузт/buuz (steamed dumpling): 90 cal/piece, 7g protein, 6g carbs, 4g fat, ~40g each
- хуушуур/khuushuur (fried dumpling): 120 cal/piece, 6g protein, 9g carbs, 6g fat, ~50g each
- банштай шол/banshtai shul (dumpling soup): 300 cal/bowl, 18g protein, 30g carbs, 10g fat
- банш/bansh (small boiled dumpling): 30 cal/piece, 2g protein, 3g carbs, 1g fat, ~15g each
- цуйван/tsuivan (stir-fried noodles with meat): 550 cal/bowl, 28g protein, 60g carbs, 20g fat, 350g
- гурилтай шол/guriltai shul (noodle soup): 300 cal/bowl, 18g protein, 35g carbs, 8g fat, 400g
- хонины шол/khoniny shul (mutton broth soup): 200 cal/bowl, 15g protein, 10g carbs, 9g fat
- тавагтай хоол/tavgain khool (plate meal with meat+rice+salad): 650 cal avg, 35g protein
- будаатай хуурга/budaatai khuurga (rice stir-fry with meat): 500 cal/plate, 30g protein, 55g carbs, 15g fat
Dairy & drinks:
- айраг/airag (fermented mare milk): 55 cal/200ml, 2g protein, 4g carbs, 2g fat
- тараг/tarag (Mongolian yogurt): 80 cal/200ml, 5g protein, 9g carbs, 2g fat
- ааруул/aaruul (dried curd snack): 40 cal/piece, 3g protein, 5g carbs, 1g fat
- өрөм/urum (clotted cream): 150 cal/2 tbsp, 1g protein, 2g carbs, 15g fat
- бяслаг/byaslaag (Mongolian cheese): 80 cal/30g, 5g protein, 1g carbs, 6g fat
- сүүтэй цай/suutei tsai (milk tea with salt): 35 cal/cup, 2g protein, 2g carbs, 2g fat
- цай/tsai (plain tea): 2 cal/cup
Breads & snacks:
- талх/talkh (bread slice): 70 cal/slice, 2g protein, 13g carbs, 1g fat
- боов/boov (fried dough cookie): 80 cal/piece, 1g protein, 10g carbs, 4g fat
Common proteins & produce:
- хонины мах/khoniny makh (mutton): 260 cal/100g, 17g protein, 0g carbs, 21g fat
- үхрийн мах/ukhriin makh (beef): 250 cal/100g, 26g protein, 0g carbs, 16g fat
- тахианы мах цээж/takhiany makh breast: 165 cal/100g, 31g protein, 0g carbs, 4g fat
- загас/zaghas (fish): 150 cal/100g, 22g protein, 0g carbs, 7g fat
- өндөг/undug (egg): 70 cal/piece, 6g protein, 0.5g carbs, 5g fat
- цагаан будаа/tsagaan budaa (white rice cooked): 200 cal/cup, 4g protein, 45g carbs, 0g fat
- төмс/tums (potato): 77 cal/100g, 2g protein, 17g carbs, 0g fat
- сүү/suu (whole milk): 150 cal/250ml, 8g protein, 12g carbs, 8g fat
- хиам/khiam (sausage): 290 cal/100g, 11g protein, 2g carbs, 27g fat
Fast food & popular UB restaurants:
- KFC original piece: 320 cal, 26g protein, 11g carbs, 20g fat
- KFC zinger burger: 560 cal, 30g protein, 50g carbs, 24g fat
- pizza slice (cheese): 280 cal, 12g protein, 36g carbs, 10g fat
- hamburger (standard): 500 cal, 25g protein, 45g carbs, 22g fat
- french fries medium: 380 cal, 5g protein, 50g carbs, 17g fat
- cola/soda 330ml: 140 cal, 0g protein, 35g carbs, 0g fat
Korean dishes popular in Ulaanbaatar:
- bibimbap: 550 cal/bowl, 20g protein, 85g carbs, 12g fat
- samgyeopsal (150g): 450 cal, 27g protein, 0g carbs, 38g fat
- ramyeon (1 pack): 450 cal, 10g protein, 60g carbs, 18g fat
- kimchi: 20 cal/100g, 1g protein, 4g carbs, 0g fat
- bulgogi (150g): 375 cal, 30g protein, 15g carbs, 21g fat

Mongolian number words: нэг=1, хоёр=2, гурав=3, дөрөв=4, тав=5, зургаа=6, долоо=7, найм=8, ес=9, арав=10
(also romanized: neg=1, khoyor=2, gurav=3, dorov=4, tav=5, zurgaa=6, doloo=7, naim=8, yes=9, arav=10)

Additional rules:
- Always return at least one item when isFoodLog is true, even if description is vague
- For combo meals, break out each component as a separate item
- If user says "цай" without qualifier, assume сүүтэй цай (milk tea, 35 cal)
- If user says "мах" without qualifier, assume хонины мах (mutton)
- Apply realistic Mongolian portion sizes: буузт are usually eaten 3-5 at a time`;

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
          { role: 'system', content: FOOD_PARSER_PROMPT },
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
