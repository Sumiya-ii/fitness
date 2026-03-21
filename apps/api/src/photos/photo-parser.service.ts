import { Injectable } from '@nestjs/common';
import { ConfigService } from '../config';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ParsedFoodItem {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  servingGrams: number;
  confidence: number;
}

export interface PhotoParseResult {
  mealName: string;
  items: ParsedFoodItem[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalFiber: number;
}

const SYSTEM_PROMPT = `You are an expert nutrition analyst specializing in food recognition from photos. Your job is to accurately identify every food item visible and estimate precise nutritional values based on visual portion sizes.

You have deep knowledge of:
- Mongolian cuisine (тал хавтгай, бууз, хуушуур, цуйван, банштай шол, тавгтай хоол, тараг, ааруул, and all traditional Mongolian dishes)
- International cuisines and packaged foods
- Standard portion sizes and plate volumes as reference cues

Return ONLY valid JSON (no markdown, no explanation):
{
  "mealName": "Short descriptive meal name (e.g., 'Буузны хоол' or 'Chicken Rice Bowl')",
  "items": [
    {
      "name": "Specific food name",
      "servingGrams": 150,
      "calories": 320,
      "protein": 18.5,
      "carbs": 35.0,
      "fat": 12.0,
      "fiber": 3.0,
      "sugar": 4.0,
      "sodium": 580,
      "confidence": 0.92
    }
  ]
}

Estimation rules:
- Use plate size, utensils, and surrounding objects as size reference cues
- servingGrams is the estimated weight in grams of that specific item as plated
- confidence is 0.0–1.0: 0.9+ means clearly visible and identifiable, 0.6–0.89 means reasonable estimate, below 0.6 means uncertain
- Use USDA / standard nutritional databases for macro values per 100g, then scale to servingGrams
- Include ALL visible food items — side dishes, garnishes, sauces, and drinks count
- If a food is partially obscured, estimate based on what's visible
- sodium is in milligrams
- Never return empty items array — always make your best estimate`;

const USER_PROMPT =
  'Analyze this food photo. Identify every item, estimate serving weights, and calculate precise nutritional values.';

function normalizeItems(raw: { items?: ParsedFoodItem[] }): PhotoParseResult {
  const items = (raw.items ?? []).map((item) => ({
    name: item.name ?? 'Unknown food',
    calories: Number(item.calories) || 0,
    protein: Number(item.protein) || 0,
    carbs: Number(item.carbs) || 0,
    fat: Number(item.fat) || 0,
    fiber: Number(item.fiber) || 0,
    sugar: Number(item.sugar) || 0,
    sodium: Number(item.sodium) || 0,
    servingGrams: Number(item.servingGrams) || 0,
    confidence: Math.min(1, Math.max(0, Number(item.confidence) || 0)),
  }));
  return {
    mealName: (raw as { mealName?: string }).mealName ?? 'Meal',
    items,
    totalCalories: items.reduce((s, i) => s + i.calories, 0),
    totalProtein: items.reduce((s, i) => s + i.protein, 0),
    totalCarbs: items.reduce((s, i) => s + i.carbs, 0),
    totalFat: items.reduce((s, i) => s + i.fat, 0),
    totalFiber: items.reduce((s, i) => s + i.fiber, 0),
  };
}

@Injectable()
export class PhotoParserService {
  private gemini: GoogleGenerativeAI | null = null;
  private openai: OpenAI | null = null;
  private readonly provider: 'gemini' | 'openai';

  constructor(private readonly config: ConfigService) {
    this.provider = this.config.get('VISION_PROVIDER');

    const geminiKey = this.config.get('GEMINI_API_KEY');
    if (geminiKey) {
      this.gemini = new GoogleGenerativeAI(geminiKey);
    }

    const openaiKey = this.config.get('OPENAI_API_KEY');
    if (openaiKey) {
      this.openai = new OpenAI({ apiKey: openaiKey });
    }
  }

  async parse(imageBase64: string): Promise<PhotoParseResult> {
    if (this.provider === 'gemini' && this.gemini) {
      try {
        return await this.parseWithGemini(imageBase64);
      } catch (err) {
        console.warn('[PhotoParser] Gemini failed, falling back to GPT-4o:', err);
        if (this.openai) {
          return await this.parseWithOpenAI(imageBase64);
        }
      }
    }

    if (this.openai) {
      return await this.parseWithOpenAI(imageBase64);
    }

    console.warn('[PhotoParser] No vision API key configured');
    return this.emptyResult();
  }

  private async parseWithGemini(imageBase64: string): Promise<PhotoParseResult> {
    const model = this.gemini!.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: SYSTEM_PROMPT,
    });

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: USER_PROMPT },
            { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
        maxOutputTokens: 2000,
      },
    });

    const content = result.response.text();
    const parsed = JSON.parse(content) as { mealName?: string; items?: ParsedFoodItem[] };
    return normalizeItems(parsed);
  }

  private async parseWithOpenAI(imageBase64: string): Promise<PhotoParseResult> {
    const response = await this.openai!.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: 'high' },
            },
            { type: 'text', text: USER_PROMPT },
          ],
        },
      ],
      max_tokens: 2000,
      temperature: 0.2,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No response from OpenAI');
    const parsed = JSON.parse(content) as { mealName?: string; items?: ParsedFoodItem[] };
    return normalizeItems(parsed);
  }

  private emptyResult(): PhotoParseResult {
    return {
      mealName: 'Meal',
      items: [],
      totalCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
      totalFiber: 0,
    };
  }
}
