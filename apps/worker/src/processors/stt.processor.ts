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
  items: ParsedFoodItem[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

const NUTRITION_SYSTEM_PROMPT = `You are a nutrition expert specializing in Mongolian and international cuisine. The user will describe what they ate in Mongolian or English. Extract all food items and estimate their nutritional content with portion details.

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "items": [
    {
      "name": "Food name (keep Mongolian script if spoken in Mongolian)",
      "quantity": 1,
      "unit": "serving",
      "grams": 200,
      "calories": 250,
      "protein": 15.0,
      "carbs": 30.0,
      "fat": 8.0,
      "confidence": 0.9
    }
  ]
}

Field rules:
- name: use the name as the user said it; keep Mongolian script for Mongolian food names
- quantity: numeric amount mentioned (e.g. 3 for "3 buurz"); default 1
- unit: one of "piece", "bowl", "cup", "plate", "slice", "glass", "can", "serving", "gram"
- grams: estimated total weight in grams for the full quantity described
- calories/protein/carbs/fat: totals for the full quantity (not per 100g)
- confidence: 0.0-1.0
  0.9-1.0 = specific quantity + well-known food ("3 buurz")
  0.7-0.8 = standard portion assumed for a clearly named food
  0.4-0.6 = vague description, unknown food, or unusual combination

Mongolian foods reference (approximate nutrition per standard serving):
Traditional meat dishes:
- buuz (steamed dumpling): 90 cal/piece, 7g protein, 6g carbs, 4g fat, ~40g each
- khuushuur (fried dumpling): 120 cal/piece, 6g protein, 9g carbs, 6g fat, ~50g each
- bansh (small boiled dumpling): 30 cal/piece, 2g protein, 3g carbs, 1g fat, ~15g each
- tsuivan (stir-fried noodles with meat): 550 cal/bowl, 28g protein, 60g carbs, 20g fat, 350g
- guriltai shul (noodle soup): 300 cal/bowl, 18g protein, 35g carbs, 8g fat, 400g
- khoniny shul (mutton broth soup): 200 cal/bowl, 15g protein, 10g carbs, 9g fat
- tavgiin khool (plate meal with meat+rice+salad): 650 cal avg, 35g protein
- budaatai khuurga (rice stir-fry with meat): 500 cal/plate, 30g protein, 55g carbs, 15g fat
- tarhantai budaa / pilaf: 480 cal/bowl, 22g protein, 60g carbs, 14g fat
Dairy & drinks:
- airag (fermented mare milk): 55 cal/200ml, 2g protein, 4g carbs, 2g fat
- tarag (Mongolian yogurt): 80 cal/200ml, 5g protein, 9g carbs, 2g fat
- aaruul (dried curd snack): 40 cal/piece, 3g protein, 5g carbs, 1g fat, 10g each
- urum (clotted cream): 150 cal/2 tbsp, 1g protein, 2g carbs, 15g fat
- byaslaag (Mongolian cheese): 80 cal/30g slice, 5g protein, 1g carbs, 6g fat
- suutei tsai (milk tea with salt): 35 cal/cup, 2g protein, 2g carbs, 2g fat
- tsai (plain tea): 2 cal/cup
Breads & snacks:
- talkh (bread loaf slice): 70 cal/slice, 2g protein, 13g carbs, 1g fat
- boov (fried dough cookie): 80 cal/piece, 1g protein, 10g carbs, 4g fat
- ul boov (layered cookie): 120 cal/piece, 2g protein, 16g carbs, 6g fat
Common proteins & produce:
- khoniny makh (mutton): 260 cal/100g, 17g protein, 0g carbs, 21g fat
- ukhriin makh (beef): 250 cal/100g, 26g protein, 0g carbs, 16g fat
- takhiany makh breast (chicken breast): 165 cal/100g, 31g protein, 0g carbs, 4g fat
- takhiany makh thigh (chicken thigh): 210 cal/100g, 26g protein, 0g carbs, 11g fat
- zaghas (fish): 150 cal/100g, 22g protein, 0g carbs, 7g fat
- undug (egg): 70 cal/piece, 6g protein, 0.5g carbs, 5g fat
- tsagaan budaa (white rice cooked): 200 cal/cup, 4g protein, 45g carbs, 0g fat
- khar budaa (brown rice cooked): 215 cal/cup, 5g protein, 45g carbs, 2g fat
- tums (potato): 77 cal/100g, 2g protein, 17g carbs, 0g fat
- baitsaa (cabbage): 25 cal/100g, 1g protein, 6g carbs, 0g fat
- luuvan (carrot): 41 cal/100g, 1g protein, 10g carbs, 0g fat
- manJin (beet): 43 cal/100g, 2g protein, 10g carbs, 0g fat
- songino (onion): 40 cal/100g, 1g protein, 9g carbs, 0g fat
- urgust khemekh (cucumber): 16 cal/100g, 1g protein, 4g carbs, 0g fat
- ulaan lool (tomato): 18 cal/100g, 1g protein, 4g carbs, 0g fat
- suu (whole milk): 150 cal/250ml, 8g protein, 12g carbs, 8g fat
- khiam (sausage): 290 cal/100g, 11g protein, 2g carbs, 27g fat
Fast food & popular UB restaurants:
- KFC original piece: 320 cal, 26g protein, 11g carbs, 20g fat
- KFC zinger burger: 560 cal, 30g protein, 50g carbs, 24g fat
- pizza slice (cheese): 280 cal, 12g protein, 36g carbs, 10g fat
- hamburger (standard): 500 cal, 25g protein, 45g carbs, 22g fat
- french fries medium: 380 cal, 5g protein, 50g carbs, 17g fat
- Subway 6-inch sandwich: 380 cal avg, 20g protein, 46g carbs, 10g fat
- cola / soda 330ml can: 140 cal, 0g protein, 35g carbs, 0g fat
Korean dishes popular in Ulaanbaatar:
- bibimbap: 550 cal/bowl, 20g protein, 85g carbs, 12g fat
- samgyeopsal (pork belly 150g): 450 cal, 27g protein, 0g carbs, 38g fat
- ramyeon (1 pack): 450 cal, 10g protein, 60g carbs, 18g fat
- kimchi: 20 cal/100g, 1g protein, 4g carbs, 0g fat
- bulgogi (150g): 375 cal, 30g protein, 15g carbs, 21g fat
- tteokbokki: 280 cal/serving, 6g protein, 55g carbs, 4g fat
- sundubu jjigae: 300 cal/bowl, 20g protein, 12g carbs, 18g fat
- japchae: 400 cal/serving, 8g protein, 55g carbs, 14g fat

Mongolian number words: neg=1, khoyor=2, gurav=3, dorov=4, tav=5, zurgaa=6, doloo=7, naim=8, yes=9, arav=10

Additional rules:
- Always return at least one item, even if the description is vague
- For combo meals, break out each component as a separate item if possible
- If user says "tsai" without qualifier, assume suutei tsai (milk tea, 35 cal)
- If user says "makh" without qualifier, assume khoniny makh (mutton)
- Apply realistic Mongolian portion sizes: buuz are usually eaten 3-5 at a time, khuushuur 2-4`;

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
      max_tokens: 800,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });
    const content = nutritionResponse.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(content) as { items?: ParsedFoodItem[] };
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
