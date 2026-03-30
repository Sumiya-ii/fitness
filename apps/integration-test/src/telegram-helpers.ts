import OpenAI from 'openai';
import { TELEGRAM_FOOD_PARSER_PROMPT } from '@coach/shared';

export interface TelegramParsedItem {
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
  items: TelegramParsedItem[];
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' | null;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

/**
 * Parse a text message for food logging intent + nutrition.
 * Mirrors telegram-food-parser.service.ts parse() method.
 */
export async function parseTelegramMessage(text: string): Promise<TelegramFoodParseResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const empty: TelegramFoodParseResult = {
    isFoodLog: false,
    items: [],
    mealType: null,
    totalCalories: 0,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
  };

  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
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

  const items: TelegramParsedItem[] = (parsed.items ?? []).map((item) => ({
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
}
