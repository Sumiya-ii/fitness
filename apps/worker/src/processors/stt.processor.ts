import { Job } from 'bullmq';
import OpenAI from 'openai';
import * as Sentry from '@sentry/node';
import {
  STT_NUTRITION_SYSTEM_PROMPT,
  VOICE_CLARIFICATION_PROMPT,
  canonicalize,
  scaleNutrition,
  shouldAskFollowUp,
  type Clarification,
  type ClarificationOption,
  type FollowUpReason,
  type FollowUpTrigger,
  type VoiceParsedItem,
} from '@coach/shared';
import { downloadFromS3, deleteFromS3 } from '../s3';
import {
  getCalibrationRatios,
  setVoiceDraftActive,
  setVoiceDraftCompleted,
  setVoiceDraftFailed,
} from '../db';

function withTimeout<T>(promise: Promise<T>, ms: number, code: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(code)), ms)),
  ]);
}

interface SttJobData {
  draftId?: string;
  userId: string;
  locale?: string;
  s3Key?: string;
  audioBuffer?: string; // base64 fallback for local dev (no S3)
}

type ParsedFoodItem = VoiceParsedItem;

/**
 * Apply per-user calibration ratios to AI-estimated items before any
 * downstream decisions (clarification, totals). Each item's
 * canonicalFoodId is resolved with the same `canonicalize()` the API uses
 * on save, so the read key matches the write key. Items without a
 * canonical match or without ≥3 samples in the user's calibration row
 * pass through untouched. Failures are non-fatal — fall back to the raw
 * model output rather than block the user.
 */
async function applyUserCalibration(
  userId: string,
  items: ParsedFoodItem[],
): Promise<ParsedFoodItem[]> {
  if (items.length === 0) return items;
  try {
    const canonicalIds = items
      .map((it) => canonicalize(it.name).id)
      .filter((id): id is string => typeof id === 'string');
    if (canonicalIds.length === 0) return items;
    const ratios = await getCalibrationRatios(userId, canonicalIds);
    if (ratios.size === 0) return items;
    return items.map((it) => {
      const id = canonicalize(it.name).id;
      if (!id) return it;
      const ratio = ratios.get(id);
      if (!ratio || ratio === 1) return it;
      return scaleNutrition(it, ratio);
    });
  } catch (err) {
    console.warn('[STT] Calibration apply failed (non-fatal):', err);
    Sentry.captureException(err, { tags: { processor: 'stt', stage: 'calibration_apply' } });
    return items;
  }
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
  totalSugar: number | null;
  totalSodium: number | null;
  totalSaturatedFat: number | null;
  clarification?: Clarification;
  /** Non-fatal warning surfaced alongside a completed draft. */
  parseWarning?: string;
}

async function markFailed(draftId: string, errorMessage: string): Promise<void> {
  try {
    await setVoiceDraftFailed(draftId, errorMessage);
  } catch (err) {
    console.error('[STT] Failed to mark draft as failed:', err);
    Sentry.captureException(err, {
      tags: { processor: 'stt', stage: 'mark_draft_failed' },
      extra: { draftId },
    });
  }
}

function clamp01(n: number, fallback: number): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

function sumOptional(
  items: ParsedFoodItem[],
  key: 'sugar' | 'sodium' | 'saturatedFat',
): number | null {
  const present = items.filter((i) => typeof i[key] === 'number');
  if (present.length === 0) return null;
  return Number(present.reduce((s, i) => s + (i[key] as number), 0).toFixed(2));
}

/**
 * Generate a single clarifying question + chip options for a triggered
 * ambiguity. Cheap (~150 tokens) GPT-4o-mini call.
 *
 * Failures here MUST NOT fail the job — clarification is best-effort UX.
 */
async function generateClarification(
  client: OpenAI,
  trigger: FollowUpTrigger,
  items: ParsedFoodItem[],
  transcription: string,
  locale: string,
): Promise<Clarification | null> {
  const targetItem = trigger.itemIndex !== null ? items[trigger.itemIndex] : null;
  const userPayload = {
    locale: locale === 'en' ? 'en' : 'mn',
    reason: trigger.reason,
    transcription,
    item: targetItem,
    allItems: items.map((i) => ({ name: i.name, quantity: i.quantity, calories: i.calories })),
  };

  try {
    const resp = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: VOICE_CLARIFICATION_PROMPT },
        { role: 'user', content: JSON.stringify(userPayload) },
      ],
      max_tokens: 400,
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });
    const content = resp.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(content) as { question?: string; options?: ClarificationOption[] };
    if (!parsed.question || !Array.isArray(parsed.options) || parsed.options.length === 0) {
      return null;
    }
    // Sanitize: cap options at 4, ensure at least one skip option exists.
    const options = parsed.options.slice(0, 4);
    const hasSkip = options.some((o) => o.patch === null);
    if (!hasSkip) {
      options.push({ label: locale === 'en' ? 'Skip' : 'Алгасах', patch: null });
    }
    return {
      question: parsed.question,
      options,
      itemIndex: trigger.itemIndex,
      reason: trigger.reason as FollowUpReason,
    };
  } catch (err) {
    console.warn('[STT] Clarification generation failed (non-fatal):', err);
    Sentry.captureException(err, {
      tags: { processor: 'stt', stage: 'clarification_generate' },
      extra: { reason: trigger.reason },
    });
    return null;
  }
}

export async function processSttJob(job: Job<SttJobData>): Promise<SttResult> {
  const { draftId, userId, s3Key, locale, audioBuffer: audioBufferB64 } = job.data;

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
      totalSugar: null,
      totalSodium: null,
      totalSaturatedFat: null,
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
    console.error('[STT] audio_download_failed:', err);
    // NoSuchKey means the S3 object was deleted before the job processed
    // (e.g. TTL expiry or user cancellation) — expected, not an actionable error.
    const errName = err instanceof Error ? err.name : '';
    const errMsg = String(err);
    const isExpectedS3Miss = errName === 'NoSuchKey' || errMsg.includes('NoSuchKey');
    if (!isExpectedS3Miss) {
      Sentry.captureException(err, {
        tags: { processor: 'stt', stage: 'audio_retrieval' },
        extra: { draftId, s3Key },
      });
    }
    if (draftId) await markFailed(draftId, 'audio_download_failed');
    throw err;
  }

  // Step 1: Transcribe with OpenAI gpt-4o-transcribe.
  // Pass an explicit ISO-639-1 hint for both supported locales — Mongolian (mn)
  // and English (en) — to avoid auto-detect mistakes on short utterances.
  let text: string;
  try {
    const formData = new FormData();
    formData.append('file', new Blob([buffer], { type: 'audio/m4a' }), 'audio.m4a');
    formData.append('model', 'gpt-4o-transcribe');
    if (locale === 'en') {
      formData.append('language', 'en');
    } else if (locale === 'mn') {
      formData.append('language', 'mn');
    }

    const response = await withTimeout(
      fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openaiApiKey}` },
        body: formData,
      }),
      25_000,
      'transcription_timeout',
    );

    if (!response.ok) {
      const errorBody = await response.text();
      Sentry.captureException(new Error(`Whisper HTTP ${response.status}: ${errorBody}`), {
        tags: { processor: 'stt', stage: 'whisper_transcription' },
        extra: { draftId, locale, status: response.status, errorBody },
      });
      throw new Error('transcription_failed');
    }

    const data = (await response.json()) as { text?: string };
    text = data.text?.trim() ?? '';

    console.log(`[STT] Transcribed (gpt-4o-transcribe, locale=${locale ?? 'auto'}):`, text);
  } catch (err) {
    const errCode =
      err instanceof Error && err.message === 'transcription_timeout'
        ? 'transcription_timeout'
        : 'transcription_failed';
    console.error(`[STT] ${errCode}:`, err);
    // Only call captureException for non-HTTP errors (HTTP non-OK already captured inline above)
    if (!(err instanceof Error && err.message === 'transcription_failed')) {
      Sentry.captureException(err, {
        tags: { processor: 'stt', stage: 'whisper_transcription' },
        extra: { draftId, locale },
      });
    }
    if (draftId) await markFailed(draftId, errCode);
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
      totalSugar: null,
      totalSodium: null,
      totalSaturatedFat: null,
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
  let parseWarning: string | undefined;
  try {
    const nutritionResponse = await withTimeout(
      client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: STT_NUTRITION_SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
        max_tokens: 1200,
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
      15_000,
      'nutrition_parse_timeout',
    );
    const content = nutritionResponse.choices[0]?.message?.content ?? '{}';
    console.log('[STT] GPT nutrition parse result:', content);
    const parsed = JSON.parse(content) as {
      mealType?: string | null;
      items?: Partial<ParsedFoodItem>[];
    };
    detectedMealType = parsed.mealType ?? null;
    items = (parsed.items ?? []).map((item): ParsedFoodItem => {
      const out: ParsedFoodItem = {
        name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : 'Unknown food',
        quantity: typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1,
        unit: typeof item.unit === 'string' && item.unit.trim() ? item.unit : 'serving',
        grams: typeof item.grams === 'number' && item.grams >= 0 ? item.grams : 0,
        calories: typeof item.calories === 'number' ? Math.max(0, item.calories) : 0,
        protein: typeof item.protein === 'number' ? Math.max(0, item.protein) : 0,
        carbs: typeof item.carbs === 'number' ? Math.max(0, item.carbs) : 0,
        fat: typeof item.fat === 'number' ? Math.max(0, item.fat) : 0,
        confidence: clamp01(item.confidence as number, 0.7),
        ambiguity: item.ambiguity ?? null,
        missing: Array.isArray(item.missing) ? (item.missing as ParsedFoodItem['missing']) : [],
      };
      if (typeof item.fiber === 'number' && item.fiber >= 0) out.fiber = item.fiber;
      if (typeof item.sugar === 'number' && item.sugar >= 0) out.sugar = item.sugar;
      if (typeof item.sodium === 'number' && item.sodium >= 0) out.sodium = item.sodium;
      if (typeof item.saturatedFat === 'number' && item.saturatedFat >= 0) {
        out.saturatedFat = item.saturatedFat;
      }
      return out;
    });
  } catch (err) {
    console.error('[STT] Nutrition parse failed:', err);
    Sentry.captureException(err, {
      tags: { processor: 'stt', stage: 'nutrition_parse' },
      extra: { draftId, textLength: text.length },
    });
    // Surface as a non-fatal warning on the completed draft so the mobile
    // client can show "We heard you but couldn't parse foods. Try again or
    // add manually." while still rendering the transcription.
    parseWarning = 'nutrition_parse_failed';
  }

  // Step 2.5: Apply per-user calibration before any downstream decisions
  // so totals and the clarification trigger see the calibrated values.
  if (userId) {
    items = await applyUserCalibration(userId, items);
  }

  // Step 3: Decide whether to ask a clarifying follow-up.
  const trigger = shouldAskFollowUp(items, text);
  let clarification: Clarification | null = null;
  if (trigger) {
    clarification = await generateClarification(client, trigger, items, text, locale ?? 'mn');
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
    totalSugar: sumOptional(items, 'sugar'),
    totalSodium: sumOptional(items, 'sodium'),
    totalSaturatedFat: sumOptional(items, 'saturatedFat'),
    ...(clarification ? { clarification } : {}),
    ...(parseWarning ? { parseWarning } : {}),
  };

  // Persist result to DB
  if (draftId) {
    await setVoiceDraftCompleted(draftId, {
      transcription: text,
      parsedItems: items,
      clarification: clarification ?? undefined,
      mealType: result.mealType,
      totalCalories: result.totalCalories,
      totalProtein: result.totalProtein,
      totalCarbs: result.totalCarbs,
      totalFat: result.totalFat,
      totalSugar: result.totalSugar ?? undefined,
      totalSodium: result.totalSodium ?? undefined,
      totalSaturatedFat: result.totalSaturatedFat ?? undefined,
      errorMessage: parseWarning,
    });
  }

  // Cleanup audio from S3 after successful processing
  if (s3Key && process.env.S3_BUCKET) {
    await deleteFromS3(s3Key);
  }

  return result;
}
