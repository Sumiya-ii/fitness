import { Job } from 'bullmq';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Pool } from 'pg';
import * as Sentry from '@sentry/node';
import { MONGOLIAN_FOOD_REFERENCE } from '@coach/shared';
import { logger } from '../logger';
import { lookupVerifiedFood } from '../foods-lookup';
import { applyUserCalibration } from '../calibration';

const OPENAI_TIMEOUT_MS = 60_000;
const GEMINI_TIMEOUT_MS = 60_000;

interface PhotoJobData {
  userId: string;
  reference: string;
  photoBuffer: string; // base64
  mode?: 'food' | 'label';
  locale?: string;
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
  source: 'verified_db' | 'ai_estimate' | 'label' | 'user_corrected';
  matchedFoodId?: string;
  flagged?: boolean;
  flagReason?: string;
}

export interface ClarificationQuestion {
  id: string;
  text: string;
  type: 'count' | 'choice';
  choices?: string[];
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
  confidenceLevel: 'high' | 'medium' | 'low';
  requiresClarification: boolean;
  clarificationQuestions?: ClarificationQuestion[];
}

// Raw AI response shapes
interface RawFoodItem {
  name?: string;
  servingGrams?: number;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  saturatedFat?: number;
  confidence?: number;
}

interface RawAIResponse {
  mealName?: string;
  items?: RawFoodItem[];
  requiresClarification?: boolean;
  clarificationQuestions?: ClarificationQuestion[];
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
  ],
  "requiresClarification": false,
  "clarificationQuestions": []
}

Estimation rules:
- Use plate size, utensils, and surrounding objects as size reference cues
- servingGrams is the estimated weight in grams of that specific item as plated
- confidence is 0.0–1.0: 0.9+ means clearly visible and identifiable, 0.6–0.89 means reasonable estimate, below 0.6 means uncertain
- Use USDA / standard nutritional databases for macro values per 100g, then scale to servingGrams
- Include ALL visible food items — side dishes, garnishes, sauces, and drinks count
- If a food is partially obscured, estimate based on what's visible with lower confidence
- sodium is in milligrams
- If you are genuinely uncertain about WHAT a food is or HOW MUCH is present, set requiresClarification: true and add up to 3 short clarification questions. You may still return your best-effort items with low confidence, or leave items empty if you have no idea at all.
- Do NOT invent items just to fill the array — an empty items array with requiresClarification: true is a valid and preferred response when uncertain.

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
  ],
  "requiresClarification": false,
  "clarificationQuestions": []
}

Rules:
- Extract EXACTLY what the label says — do not estimate or guess
- If serving size is not in grams, convert it (e.g., "1 cup (240ml)" → estimate grams)
- confidence should reflect label readability: 0.95+ = clearly legible, 0.7–0.94 = partially obscured, <0.7 = hard to read
- If multiple serving sizes are shown, use the per-serving values (not per-100g)
- sodium is in milligrams
- Always return exactly one item in the items array (the product from the label)
- If you cannot read the label at all, set requiresClarification: true and explain what is unclear`;

const LABEL_USER_PROMPT =
  'Read this nutrition label photo. Extract the product name, serving size, and all nutritional values exactly as printed.';

const USER_PROMPT =
  'Analyze this food photo. Identify every item, estimate serving weights, and calculate precise nutritional values.';

const MODE_DETECT_PROMPT =
  'Is this image a nutrition label (packaging/label with printed nutritional facts table) or a food photo (actual food/meal)? Return ONLY valid JSON: {"mode":"food"} or {"mode":"label"}';

/** Macro identity sanity check: 4*P + 4*C + 9*F should be within 20% of reported kcal. */
function checkMacroIdentity(item: ParsedFoodItem): { flagged: boolean; flagReason?: string } {
  const { calories, protein, carbs, fat } = item;
  if (calories <= 0) return { flagged: false };
  const expected = 4 * protein + 4 * carbs + 9 * fat;
  const deviation = Math.abs(calories - expected) / Math.max(calories, expected);
  if (deviation > 0.2) {
    return {
      flagged: true,
      flagReason: 'Macros do not add up to calories',
    };
  }
  return { flagged: false };
}

function computeConfidenceLevel(items: ParsedFoodItem[]): 'high' | 'medium' | 'low' {
  if (items.length === 0) return 'low';
  const avg = items.reduce((s, i) => s + i.confidence, 0) / items.length;
  if (avg >= 0.8) return 'high';
  if (avg >= 0.5) return 'medium';
  return 'low';
}

function normalizeItems(
  raw: RawAIResponse,
  isLabel: boolean,
): Omit<PhotoParseResult, 'confidenceLevel' | 'requiresClarification' | 'clarificationQuestions'> &
  Pick<PhotoParseResult, 'requiresClarification' | 'clarificationQuestions'> {
  const items: ParsedFoodItem[] = (raw.items ?? []).map((item) => {
    const normalized: ParsedFoodItem = {
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
      source: isLabel ? 'label' : 'ai_estimate',
    };
    const check = checkMacroIdentity(normalized);
    if (check.flagged) {
      normalized.flagged = true;
      normalized.flagReason = check.flagReason;
    }
    return normalized;
  });

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
    requiresClarification: raw.requiresClarification ?? false,
    clarificationQuestions:
      raw.clarificationQuestions && raw.clarificationQuestions.length > 0
        ? raw.clarificationQuestions.slice(0, 3)
        : undefined,
  };
}

function buildEmptyResult(): PhotoParseResult {
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
    confidenceLevel: 'low',
    requiresClarification: false,
  };
}

/** Auto-detect food vs label mode using Gemini Flash (cheap). Returns null if unavailable or fails. */
async function detectMode(imageBase64: string, apiKey: string): Promise<'food' | 'label' | null> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: MODE_DETECT_PROMPT },
            { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0,
        maxOutputTokens: 20,
      },
    });
    const parsed = JSON.parse(result.response.text()) as { mode?: string };
    const m = parsed.mode;
    if (m === 'food' || m === 'label') return m;
    return null;
  } catch {
    return null;
  }
}

async function parseWithGemini(
  imageBase64: string,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  isLabel: boolean,
): Promise<ReturnType<typeof normalizeItems>> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: systemPrompt,
  });

  const timeoutSignal = AbortSignal.timeout(GEMINI_TIMEOUT_MS);
  const result = await model.generateContent(
    {
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
    },
    { signal: timeoutSignal },
  );

  const content = result.response.text();
  return normalizeItems(JSON.parse(content) as RawAIResponse, isLabel);
}

async function parseWithOpenAI(
  imageBase64: string,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  isLabel: boolean,
): Promise<ReturnType<typeof normalizeItems>> {
  const client = new OpenAI({ apiKey, timeout: OPENAI_TIMEOUT_MS });
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
  return normalizeItems(JSON.parse(content) as RawAIResponse, isLabel);
}

/** Apply DB verification and calibration to all items. */
async function enrichItems(
  items: ParsedFoodItem[],
  userId: string,
  pool: Pool,
): Promise<ParsedFoodItem[]> {
  return Promise.all(
    items.map(async (item) => {
      // Skip DB lookup for label-sourced items (already exact)
      if (item.source === 'label') return item;

      const match = await lookupVerifiedFood(item.name, pool);
      let enriched = item;

      if (match) {
        const scale = item.servingGrams > 0 ? item.servingGrams / 100 : 1;
        enriched = {
          ...item,
          calories: match.perHundredG.kcal * scale,
          protein: match.perHundredG.p * scale,
          carbs: match.perHundredG.c * scale,
          fat: match.perHundredG.f * scale,
          fiber: match.perHundredG.fi * scale,
          sugar: match.perHundredG.su * scale,
          sodium: match.perHundredG.so * scale,
          saturatedFat: match.perHundredG.sf * scale,
          source: 'verified_db',
          matchedFoodId: match.id,
          confidence: Math.max(item.confidence, 0.9),
          // Re-run macro check with verified numbers — should pass, clear any stale flag
          flagged: undefined,
          flagReason: undefined,
        };
        // Re-check macro identity with the verified numbers (they should agree)
        const check = checkMacroIdentity(enriched);
        if (check.flagged) {
          enriched.flagged = true;
          enriched.flagReason = check.flagReason;
        }
      }

      enriched = await applyUserCalibration(userId, enriched, pool);
      return enriched;
    }),
  );
}

let _pool: Pool | undefined;
function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return _pool;
}

export async function processPhotoJob(job: Job<PhotoJobData>): Promise<PhotoParseResult> {
  const { photoBuffer, userId } = job.data;
  let { mode } = job.data;
  const provider = process.env.VISION_PROVIDER ?? 'gemini';
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  // Step 1: Auto-detect mode if Gemini key available
  if (geminiKey) {
    const detectedMode = await detectMode(photoBuffer, geminiKey);
    if (detectedMode && detectedMode !== mode) {
      logger.info(
        { jobId: job.id, userMode: mode, detectedMode },
        '[Photo] Mode auto-corrected by detection',
      );
      Sentry.addBreadcrumb({
        category: 'photo',
        message: 'Mode auto-corrected',
        data: { userMode: mode, detectedMode },
        level: 'info',
      });
      mode = detectedMode;
    }
  }

  const isLabel = mode === 'label';
  const systemPrompt = isLabel ? LABEL_SYSTEM_PROMPT : SYSTEM_PROMPT;
  const userPrompt = isLabel ? LABEL_USER_PROMPT : USER_PROMPT;

  // Step 2: Parse with AI
  let parsed: ReturnType<typeof normalizeItems> | null = null;

  if (provider === 'gemini' && geminiKey) {
    try {
      parsed = await parseWithGemini(photoBuffer, geminiKey, systemPrompt, userPrompt, isLabel);
    } catch (err) {
      logger.warn(
        { error: err instanceof Error ? err.message : String(err), mode },
        '[Photo] Gemini failed, falling back to GPT-4o',
      );
      Sentry.captureException(err, {
        tags: { processor: 'photo', stage: 'gemini_parse', fallback: 'openai' },
        extra: { mode },
      });
      if (openaiKey) {
        try {
          parsed = await parseWithOpenAI(photoBuffer, openaiKey, systemPrompt, userPrompt, isLabel);
        } catch (err2) {
          logger.error(
            { error: err2 instanceof Error ? err2.message : String(err2) },
            '[Photo] OpenAI fallback also failed',
          );
        }
      }
    }
  } else if (openaiKey) {
    try {
      parsed = await parseWithOpenAI(photoBuffer, openaiKey, systemPrompt, userPrompt, isLabel);
    } catch (err) {
      logger.error(
        { error: err instanceof Error ? err.message : String(err) },
        '[Photo] OpenAI parse failed',
      );
    }
  }

  if (!parsed) {
    logger.warn({ jobId: job.id }, '[Photo] No vision API key configured or all providers failed');
    return buildEmptyResult();
  }

  // Step 3: Enrich items with DB lookup + calibration (only when DB is available)
  let enrichedItems = parsed.items;
  if (process.env.DATABASE_URL) {
    try {
      enrichedItems = await enrichItems(parsed.items, userId, getPool());
    } catch (err) {
      logger.warn(
        { error: err instanceof Error ? err.message : String(err) },
        '[Photo] Item enrichment failed, using raw AI items',
      );
    }
  }

  // Step 4: Compute confidence level and clarification flag
  const confidenceLevel = computeConfidenceLevel(enrichedItems);
  const requiresClarification = parsed.requiresClarification || confidenceLevel === 'low';

  // Recompute totals after enrichment
  const result: PhotoParseResult = {
    mealName: parsed.mealName,
    items: enrichedItems,
    totalCalories: enrichedItems.reduce((s, i) => s + i.calories, 0),
    totalProtein: enrichedItems.reduce((s, i) => s + i.protein, 0),
    totalCarbs: enrichedItems.reduce((s, i) => s + i.carbs, 0),
    totalFat: enrichedItems.reduce((s, i) => s + i.fat, 0),
    totalFiber: enrichedItems.reduce((s, i) => s + i.fiber, 0),
    totalSugar: enrichedItems.reduce((s, i) => s + i.sugar, 0),
    totalSodium: enrichedItems.reduce((s, i) => s + i.sodium, 0),
    totalSaturatedFat: enrichedItems.reduce((s, i) => s + i.saturatedFat, 0),
    confidenceLevel,
    requiresClarification,
    clarificationQuestions: parsed.clarificationQuestions,
  };

  return result;
}
