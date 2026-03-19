import { Job } from 'bullmq';
import OpenAI from 'openai';
import { toFile } from 'openai/uploads';

interface SttJobData {
  userId: string;
  audioBuffer: string; // base64
  locale?: string;
}

interface ParsedFoodItem {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface SttResult {
  text: string;
  locale?: string;
  items: ParsedFoodItem[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

const NUTRITION_SYSTEM_PROMPT = `You are a nutrition expert. The user will describe what they ate in Mongolian or English. Extract all food items and estimate their nutritional content.

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "items": [
    {
      "name": "Food name as spoken",
      "calories": 250,
      "protein": 15.0,
      "carbs": 30.0,
      "fat": 8.0
    }
  ]
}

Rules:
- Use realistic portion sizes based on what the user described
- If no quantity is mentioned, assume a standard single serving
- Include all mentioned food items
- Know Mongolian foods: цагаан будаа (white rice), цуйван (tsuivan noodles), бууз (buuz dumplings), хуушуур (khuushuur fried dumplings), бандш (bansh small dumplings), шөл (soup), айраг (fermented mare milk), тараг (yogurt), өндөг (egg), мах (meat), тахиа (chicken), гурил (flour/bread), байцаа (cabbage), лууван (carrot), манжин (beet), etc.
- Always return at least one item`;

export async function processSttJob(job: Job<SttJobData>): Promise<SttResult> {
  const { audioBuffer, locale } = job.data;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.warn('[STT] OPENAI_API_KEY not set, returning empty result');
    return {
      text: '',
      locale,
      items: [],
      totalCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
    };
  }

  const client = new OpenAI({ apiKey });

  // Step 1: Transcribe with OpenAI Whisper (cheapest STT model)
  const buffer = Buffer.from(audioBuffer, 'base64');
  const audioFile = await toFile(buffer, 'recording.m4a', { type: 'audio/m4a' });

  const transcription = await client.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-1',
    language: locale ?? 'mn',
  });

  const text = transcription.text.trim();
  console.log('[STT] Transcribed:', text);

  if (!text) {
    return {
      text: '',
      locale,
      items: [],
      totalCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
    };
  }

  // Step 2: Parse nutrition with GPT-4o-mini (cheapest chat model)
  const nutritionResponse = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: NUTRITION_SYSTEM_PROMPT },
      { role: 'user', content: text },
    ],
    max_tokens: 500,
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  const content = nutritionResponse.choices[0]?.message?.content ?? '{}';
  let items: ParsedFoodItem[] = [];

  try {
    const parsed = JSON.parse(content) as { items?: ParsedFoodItem[] };
    items = parsed.items ?? [];
  } catch (e) {
    console.error('[STT] Failed to parse nutrition JSON:', e, 'content:', content);
  }

  return {
    text,
    locale,
    items,
    totalCalories: Math.round(items.reduce((s, i) => s + i.calories, 0)),
    totalProtein: Number(items.reduce((s, i) => s + i.protein, 0).toFixed(2)),
    totalCarbs: Number(items.reduce((s, i) => s + i.carbs, 0).toFixed(2)),
    totalFat: Number(items.reduce((s, i) => s + i.fat, 0).toFixed(2)),
  };
}
