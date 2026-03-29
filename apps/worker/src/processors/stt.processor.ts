import { Job } from 'bullmq';
import OpenAI from 'openai';
import { STT_NUTRITION_SYSTEM_PROMPT } from '@coach/shared';
import { downloadFromS3, deleteFromS3 } from '../s3';
import { setVoiceDraftActive, setVoiceDraftCompleted, setVoiceDraftFailed } from '../db';

interface SttJobData {
  draftId?: string;
  userId: string;
  locale?: string;
  s3Key?: string;
  audioBuffer?: string; // base64 fallback for local dev (no S3)
}

interface ParsedFoodItem {
  name: string;
  quantity: number;
  unit: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: number; // 0.0–1.0
}

interface SttResult {
  text: string;
  locale?: string;
  mealType: string | null;
  items: ParsedFoodItem[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

async function markFailed(draftId: string, errorMessage: string): Promise<void> {
  try {
    await setVoiceDraftFailed(draftId, errorMessage);
  } catch (err) {
    console.error('[STT] Failed to mark draft as failed:', err);
  }
}

export async function processSttJob(job: Job<SttJobData>): Promise<SttResult> {
  const { draftId, s3Key, locale, audioBuffer: audioBufferB64 } = job.data;

  // Mark draft active
  if (draftId) {
    await setVoiceDraftActive(draftId);
  }

  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!openaiApiKey) {
    const msg = 'OPENAI_API_KEY not set (needed for transcription and nutrition parsing)';
    console.warn(`[STT] ${msg}`);
    if (draftId) await markFailed(draftId, msg);
    return {
      text: '',
      locale,
      mealType: null,
      items: [],
      totalCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
    };
  }

  let buffer: Buffer;
  try {
    if (s3Key && process.env.S3_BUCKET) {
      buffer = await downloadFromS3(s3Key);
    } else if (audioBufferB64) {
      // Local dev fallback: audio stored as base64 in job data
      buffer = Buffer.from(audioBufferB64, 'base64');
    } else {
      throw new Error('No audio source: s3Key and audioBuffer are both missing');
    }
  } catch (err) {
    const msg = `Audio retrieval failed: ${String(err)}`;
    console.error(`[STT] ${msg}`);
    if (draftId) await markFailed(draftId, msg);
    throw err;
  }

  // Step 1: Transcribe with OpenAI Whisper
  let text: string;
  try {
    const formData = new FormData();
    formData.append('file', new Blob([buffer], { type: 'audio/m4a' }), 'audio.m4a');
    formData.append('model', 'gpt-4o-transcribe');
    // Only set language hint for languages Whisper supports directly.
    // Mongolian is not supported — omit to let the model auto-detect.
    if (locale === 'en') {
      formData.append('language', 'en');
    }

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiApiKey}` },
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Whisper HTTP ${response.status}: ${errorBody}`);
    }

    const data = (await response.json()) as { text?: string };
    text = data.text?.trim() ?? '';

    console.log(`[STT] Transcribed (gpt-4o-transcribe, locale=${locale ?? 'auto'}):`, text);
  } catch (err) {
    const msg = `Transcription failed: ${String(err)}`;
    console.error(`[STT] ${msg}`);
    if (draftId) await markFailed(draftId, msg);
    if (s3Key && process.env.S3_BUCKET) await deleteFromS3(s3Key);
    throw err;
  }

  if (!text) {
    const emptyResult: SttResult = {
      text: '',
      locale,
      mealType: null,
      items: [],
      totalCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
    };
    if (draftId) {
      await setVoiceDraftCompleted(draftId, {
        transcription: '',
        parsedItems: [],
        mealType: null,
        totalCalories: 0,
        totalProtein: 0,
        totalCarbs: 0,
        totalFat: 0,
      });
    }
    if (s3Key && process.env.S3_BUCKET) await deleteFromS3(s3Key);
    return emptyResult;
  }

  // Step 2: Parse nutrition with GPT-4o-mini
  const client = new OpenAI({ apiKey: openaiApiKey });
  let items: ParsedFoodItem[] = [];
  let detectedMealType: string | null = null;
  try {
    const nutritionResponse = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: STT_NUTRITION_SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
      max_tokens: 800,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });
    const content = nutritionResponse.choices[0]?.message?.content ?? '{}';
    console.log('[STT] GPT nutrition parse result:', content);
    const parsed = JSON.parse(content) as { mealType?: string | null; items?: ParsedFoodItem[] };
    detectedMealType = parsed.mealType ?? null;
    items = (parsed.items ?? []).map((item) => ({
      ...item,
      quantity: item.quantity ?? 1,
      unit: item.unit ?? 'serving',
      grams: item.grams ?? 0,
      confidence: Math.min(1, Math.max(0, item.confidence ?? 0.7)),
    }));
  } catch (err) {
    console.error('[STT] Nutrition parse failed:', err);
    // Don't fail the whole job — return transcription with empty items
  }

  const result: SttResult = {
    text,
    locale,
    mealType: detectedMealType,
    items,
    totalCalories: Math.round(items.reduce((s, i) => s + i.calories, 0)),
    totalProtein: Number(items.reduce((s, i) => s + i.protein, 0).toFixed(2)),
    totalCarbs: Number(items.reduce((s, i) => s + i.carbs, 0).toFixed(2)),
    totalFat: Number(items.reduce((s, i) => s + i.fat, 0).toFixed(2)),
  };

  // Persist result to DB
  if (draftId) {
    await setVoiceDraftCompleted(draftId, {
      transcription: text,
      parsedItems: items,
      mealType: result.mealType,
      totalCalories: result.totalCalories,
      totalProtein: result.totalProtein,
      totalCarbs: result.totalCarbs,
      totalFat: result.totalFat,
    });
  }

  // Cleanup audio from S3 after successful processing
  if (s3Key && process.env.S3_BUCKET) {
    await deleteFromS3(s3Key);
  }

  return result;
}
