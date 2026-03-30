import { Job } from 'bullmq';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as Sentry from '@sentry/node';
import { MONGOLIAN_FOOD_REFERENCE } from '@coach/shared';

interface PhotoJobData {
  userId: string;
  reference: string;
  photoBuffer: string; // base64
  mode?: 'food' | 'label';
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
  saturatedFat: number;
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
  totalSugar: number;
  totalSodium: number;
  totalSaturatedFat: number;
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
      "saturatedFat": 3.5,
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
- Never return empty items array — always make your best estimate

${MONGOLIAN_FOOD_REFERENCE}`;

const LABEL_SYSTEM_PROMPT = `You are an expert nutrition label reader. Your job is to accurately extract all nutritional information from a photograph of a product's nutrition facts label or packaging.

Read the label carefully and extract:
- Product/food name (from the package or label heading)
- Serving size in grams (convert from other units if needed)
- All nutritional values PER SERVING as printed on the label

You have deep knowledge of:
- Nutrition Facts labels (US FDA format)
- Mongolian nutrition labels (Хүнсний шошго)
- International label formats (EU, Australian, etc.)
- Unit conversions (oz → g, cups → g, etc.)

Return ONLY valid JSON (no markdown, no explanation):
{
  "mealName": "Product name from the label",
  "items": [
    {
      "name": "Product name",
      "servingGrams": 30,
      "calories": 120,
      "protein": 3.0,
      "carbs": 22.0,
      "fat": 2.5,
      "fiber": 1.0,
      "sugar": 8.0,
      "sodium": 150,
      "saturatedFat": 0.5,
      "confidence": 0.97
    }
  ]
}

Rules:
- Extract EXACTLY what the label says — do not estimate or guess
- If serving size is not in grams, convert it (e.g., "1 cup (240ml)" → estimate grams)
- confidence should reflect label readability: 0.95+ = clearly legible, 0.7–0.94 = partially obscured, <0.7 = hard to read
- If multiple serving sizes are shown, use the per-serving values (not per-100g)
- sodium is in milligrams
- Always return exactly one item in the items array (the product from the label)
- If you cannot read the label at all, return your best guess with low confidence`;

const LABEL_USER_PROMPT =
  'Read this nutrition label photo. Extract the product name, serving size, and all nutritional values exactly as printed.';

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
    saturatedFat: Number(item.saturatedFat) || 0,
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
    totalSugar: items.reduce((s, i) => s + i.sugar, 0),
    totalSodium: items.reduce((s, i) => s + i.sodium, 0),
    totalSaturatedFat: items.reduce((s, i) => s + i.saturatedFat, 0),
  };
}

async function parseWithGemini(
  imageBase64: string,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<PhotoParseResult> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: systemPrompt,
  });

  const result = await model.generateContent({
    contents: [
      {
        role: 'user',
        parts: [
          { text: userPrompt },
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

async function parseWithOpenAI(
  imageBase64: string,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<PhotoParseResult> {
  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: 'high' },
          },
          { type: 'text', text: userPrompt },
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
  const { photoBuffer, mode } = job.data;
  const provider = process.env.VISION_PROVIDER ?? 'gemini';
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  const systemPrompt = mode === 'label' ? LABEL_SYSTEM_PROMPT : SYSTEM_PROMPT;
  const userPrompt = mode === 'label' ? LABEL_USER_PROMPT : USER_PROMPT;

  if (provider === 'gemini' && geminiKey) {
    try {
      return await parseWithGemini(photoBuffer, geminiKey, systemPrompt, userPrompt);
    } catch (err) {
      console.warn('[Photo] Gemini failed, falling back to GPT-4o:', err);
      Sentry.captureException(err, {
        tags: { processor: 'photo', stage: 'gemini_parse', fallback: 'openai' },
        extra: { mode },
      });
      if (openaiKey) {
        return await parseWithOpenAI(photoBuffer, openaiKey, systemPrompt, userPrompt);
      }
    }
  }

  if (openaiKey) {
    return await parseWithOpenAI(photoBuffer, openaiKey, systemPrompt, userPrompt);
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
    totalSugar: 0,
    totalSodium: 0,
    totalSaturatedFat: 0,
  };
}
