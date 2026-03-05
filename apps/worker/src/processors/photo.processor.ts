import { Job } from 'bullmq';
import OpenAI from 'openai';

interface PhotoJobData {
  userId: string;
  reference: string;
  photoBuffer: string; // base64
}

interface ParsedFoodItem {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: number;
}

interface PhotoParseResult {
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

export async function processPhotoJob(job: Job<PhotoJobData>): Promise<PhotoParseResult> {
  const { photoBuffer } = job.data;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.warn('[Photo] OPENAI_API_KEY not set, returning empty result');
    return {
      items: [{ name: 'Unidentified meal', calories: 0, protein: 0, carbs: 0, fat: 0, confidence: 0 }],
      totalCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
    };
  }

  const client = new OpenAI({ apiKey });

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${photoBuffer}`,
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
    throw new Error('No response from OpenAI');
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
}
