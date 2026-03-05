import { Injectable } from '@nestjs/common';
import { ConfigService } from '../config';
import OpenAI from 'openai';

export interface ParsedFoodItem {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: number;
}

export interface PhotoParseResult {
  items: ParsedFoodItem[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

const SYSTEM_PROMPT = `You are a nutrition analysis assistant. When given a photo of food, identify each food item visible and estimate its nutritional content.

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "items": [
    {
      "name": "Food name",
      "calories": 250,
      "protein": 15.0,
      "carbs": 30.0,
      "fat": 8.0,
      "confidence": 0.85
    }
  ]
}

Rules:
- Estimate realistic portion sizes based on visual cues
- Confidence is 0.0-1.0 based on how certain you are about identification and portion
- Use standard nutritional values per estimated portion
- Include all visible food items
- If you cannot identify a food, use your best guess with low confidence
- Always return at least one item`;

@Injectable()
export class PhotoParserService {
  private client: OpenAI | null = null;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get('OPENAI_API_KEY');
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
    }
  }

  async parse(imageBase64: string): Promise<PhotoParseResult> {
    if (!this.client) {
      return this.fallbackResult();
    }

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                  detail: 'low',
                },
              },
              {
                type: 'text',
                text: 'Identify the food items in this image and estimate their nutritional content.',
              },
            ],
          },
        ],
        max_tokens: 1000,
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return this.fallbackResult();
      }

      const parsed = JSON.parse(content) as { items?: ParsedFoodItem[] };
      const items = parsed.items ?? [];

      return {
        items,
        totalCalories: items.reduce((s, i) => s + i.calories, 0),
        totalProtein: items.reduce((s, i) => s + i.protein, 0),
        totalCarbs: items.reduce((s, i) => s + i.carbs, 0),
        totalFat: items.reduce((s, i) => s + i.fat, 0),
      };
    } catch (err) {
      console.error('[PhotoParser] OpenAI error:', err);
      return this.fallbackResult();
    }
  }

  private fallbackResult(): PhotoParseResult {
    return {
      items: [
        {
          name: 'Unidentified meal',
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          confidence: 0,
        },
      ],
      totalCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
    };
  }
}
