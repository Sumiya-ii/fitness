import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';
import { STT_NUTRITION_SYSTEM_PROMPT } from '@coach/shared';

export interface ParsedFoodItem {
  name: string;
  quantity: number;
  unit: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: number;
}

export interface NutritionResult {
  mealType: string | null;
  items: ParsedFoodItem[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

export type SttProvider = 'openai' | 'google';

// ---------------------------------------------------------------------------
// STT: OpenAI (gpt-4o-transcribe)
// ---------------------------------------------------------------------------

/**
 * Transcribe audio using OpenAI gpt-4o-transcribe.
 * Mirrors the production stt.processor.ts Whisper call.
 */
export async function transcribeWithOpenAI(filePath: string, language = 'mn'): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const buffer = fs.readFileSync(filePath);
  const formData = new FormData();
  formData.append('file', new Blob([buffer], { type: 'audio/wav' }), path.basename(filePath));
  formData.append('model', 'gpt-4o-transcribe');
  if (language === 'en') {
    formData.append('language', 'en');
  }

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI STT HTTP ${response.status}: ${errorBody}`);
  }

  const data = (await response.json()) as { text?: string };
  return data.text?.trim() ?? '';
}

// ---------------------------------------------------------------------------
// STT: Google Cloud Speech-to-Text
// ---------------------------------------------------------------------------

/**
 * Transcribe audio using Google Cloud Speech-to-Text v1.
 * Requires GOOGLE_STT_API_KEY or GOOGLE_APPLICATION_CREDENTIALS in env.
 */
export async function transcribeWithGoogle(filePath: string, language = 'mn'): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const speech = require('@google-cloud/speech');
  const client = new speech.SpeechClient();

  const buffer = fs.readFileSync(filePath);
  const audio = { content: buffer.toString('base64') };

  // Map locale to BCP-47 language code
  const languageCode = language === 'en' ? 'en-US' : 'mn-MN';

  const config = {
    encoding: 'LINEAR16' as const,
    languageCode,
    // 'default' model has the broadest language support including mn-MN.
    // 'latest_long' does not support Mongolian.
    model: 'default',
    enableAutomaticPunctuation: true,
  };

  const [response] = await client.recognize({ audio, config });

  const transcript = (response.results ?? [])
    .map(
      (result: { alternatives?: { transcript?: string }[] }) =>
        result.alternatives?.[0]?.transcript ?? '',
    )
    .join(' ')
    .trim();

  return transcript;
}

// ---------------------------------------------------------------------------
// Unified transcribe function
// ---------------------------------------------------------------------------

/**
 * Transcribe audio using the specified provider.
 * Defaults to OpenAI if no provider specified.
 */
export async function transcribeAudio(
  filePath: string,
  language = 'mn',
  provider: SttProvider = 'openai',
): Promise<string> {
  switch (provider) {
    case 'google':
      return transcribeWithGoogle(filePath, language);
    case 'openai':
    default:
      return transcribeWithOpenAI(filePath, language);
  }
}

// ---------------------------------------------------------------------------
// Nutrition parsing (LLM) — provider-independent
// ---------------------------------------------------------------------------

/**
 * Send transcript to GPT-4o-mini for nutrition parsing.
 * Mirrors stt.processor.ts lines 153-173.
 */
export async function parseNutrition(transcript: string): Promise<NutritionResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: STT_NUTRITION_SYSTEM_PROMPT },
      { role: 'user', content: transcript },
    ],
    max_tokens: 800,
    temperature: 0.2,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(content) as { mealType?: string | null; items?: ParsedFoodItem[] };

  const items = (parsed.items ?? []).map((item) => ({
    ...item,
    quantity: item.quantity ?? 1,
    unit: item.unit ?? 'serving',
    grams: item.grams ?? 0,
    confidence: Math.min(1, Math.max(0, item.confidence ?? 0.7)),
  }));

  return {
    mealType: parsed.mealType ?? null,
    items,
    totalCalories: Math.round(items.reduce((s, i) => s + i.calories, 0)),
    totalProtein: Number(items.reduce((s, i) => s + i.protein, 0).toFixed(2)),
    totalCarbs: Number(items.reduce((s, i) => s + i.carbs, 0).toFixed(2)),
    totalFat: Number(items.reduce((s, i) => s + i.fat, 0).toFixed(2)),
  };
}

// ---------------------------------------------------------------------------
// Full pipeline
// ---------------------------------------------------------------------------

/** Full pipeline: audio file -> STT -> GPT-4o-mini -> nutrition result */
export async function fullPipeline(
  filePath: string,
  language = 'mn',
  provider: SttProvider = 'openai',
): Promise<NutritionResult & { text: string }> {
  const text = await transcribeAudio(filePath, language, provider);
  const nutrition = await parseNutrition(text);
  return { text, ...nutrition };
}

/** Resolve a fixture file path relative to the fixtures directory */
export function fixture(filename: string): string {
  return path.resolve(__dirname, '..', 'fixtures', filename);
}
