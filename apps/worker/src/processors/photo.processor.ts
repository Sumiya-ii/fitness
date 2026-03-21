import { Job } from 'bullmq';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface PhotoJobData {
  userId: string;
  reference: string;
  photoBuffer: string; // base64
}

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

function normalizeItems(raw: { mealName?: string; items?: ParsedFoodItem[] }): PhotoParseResult {
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
    mealName: raw.mealName ?? 'Meal',
    items,
    totalCalories: items.reduce((s, i) => s + i.calories, 0),
    totalProtein: items.reduce((s, i) => s + i.protein, 0),
    totalCarbs: items.reduce((s, i) => s + i.carbs, 0),
    totalFat: items.reduce((s, i) => s + i.fat, 0),
    totalFiber: items.reduce((s, i) => s + i.fiber, 0),
  };
}

async function parseWithGemini(imageBase64: string, apiKey: string): Promise<PhotoParseResult> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
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
  return normalizeItems(JSON.parse(content) as { mealName?: string; items?: ParsedFoodItem[] });
}

async function parseWithOpenAI(imageBase64: string, apiKey: string): Promise<PhotoParseResult> {
  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
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
  return normalizeItems(JSON.parse(content) as { mealName?: string; items?: ParsedFoodItem[] });
}

export async function processPhotoJob(job: Job<PhotoJobData>): Promise<PhotoParseResult> {
  const { photoBuffer } = job.data;
  const provider = process.env.VISION_PROVIDER ?? 'gemini';
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (provider === 'gemini' && geminiKey) {
    try {
      return await parseWithGemini(photoBuffer, geminiKey);
    } catch (err) {
      console.warn('[Photo] Gemini failed, falling back to GPT-4o:', err);
      if (openaiKey) {
        return await parseWithOpenAI(photoBuffer, openaiKey);
      }
    }
  }

  if (openaiKey) {
    return await parseWithOpenAI(photoBuffer, openaiKey);
  }

  console.warn('[Photo] No vision API key configured');
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
