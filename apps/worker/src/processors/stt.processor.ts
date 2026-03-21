import { Job } from 'bullmq';
import OpenAI from 'openai';
import { toFile } from 'openai/uploads';
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
- Know Mongolian foods: цагаан будаа (white rice), цуйван (tsuivan noodles), бууз (buuz dumplings), хуушуур (khuushuur fried dumplings), бандш (bansh small dumplings), шөл (soup), айраг (fermented mare milk), тараг (yogurt), өндөг (egg), мах (meat), тахиа (chicken), гурил (flour/bread), байцаа (cabbage), лууван (carrot), манжин (beet), сүү (milk), ааруул (dried curd), бяслаг (cheese), өрөм (clotted cream), талх (bread), боов (cookie), суутэй цай (milk tea), хонины мах (mutton), үхрийн мах (beef), хиам (sausage)
- Also recognize common fast food and Korean dishes popular in Ulaanbaatar
- Always return at least one item`;

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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const msg = 'OPENAI_API_KEY not set';
    console.warn(`[STT] ${msg}`);
    if (draftId) await markFailed(draftId, msg);
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

  const client = new OpenAI({ apiKey });

  // Step 1: Transcribe with Whisper
  let text: string;
  try {
    const audioFile = await toFile(buffer, 'recording.m4a', { type: 'audio/m4a' });
    const transcription = await client.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: locale ?? 'mn',
    });
    text = transcription.text.trim();
    console.log('[STT] Transcribed:', text);
  } catch (err) {
    const msg = `Transcription failed: ${String(err)}`;
    console.error(`[STT] ${msg}`);
    if (draftId) await markFailed(draftId, msg);
    // Cleanup S3 even on failure
    if (s3Key && process.env.S3_BUCKET) await deleteFromS3(s3Key);
    throw err;
  }

  if (!text) {
    const emptyResult: SttResult = {
      text: '',
      locale,
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
  let items: ParsedFoodItem[] = [];
  try {
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
    const parsed = JSON.parse(content) as { items?: ParsedFoodItem[] };
    items = parsed.items ?? [];
  } catch (err) {
    console.error('[STT] Nutrition parse failed:', err);
    // Don't fail the whole job — return transcription with empty items
  }

  const result: SttResult = {
    text,
    locale,
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
