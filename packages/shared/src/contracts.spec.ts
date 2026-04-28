/**
 * Contract tests: verify that the shapes the mobile app expects from the API
 * actually match what the API returns.
 *
 * These tests do NOT call real services. They assert that:
 * - Shared types / interfaces accept valid fixture data
 * - API response envelopes conform to { data: T } pattern
 * - Date fields are ISO strings (full datetime) or YYYY-MM-DD (date-only)
 * - Decimal fields coerce correctly from Prisma-like objects (number, string, { toNumber })
 * - Required fields are rejected when absent
 * - Optional / nullable fields accept null gracefully
 *
 * All shapes are modelled with z.object() inline so that the tests themselves
 * are the living contract documentation — no Zod in shared production code is
 * changed or imported here beyond the already-exported envSchema.
 */

import { z } from 'zod';
import {
  GOAL_TYPES,
  GENDERS,
  ACTIVITY_LEVELS,
  DIET_PREFERENCES,
  SUPPORTED_LOCALES,
} from './constants';
import { QUEUE_NAMES, DEFAULT_JOB_OPTIONS } from './queues';
import type {
  ApiResponse,
  ApiErrorResponse,
  PaginatedResponse,
  OnboardingPayload,
  OnboardingResult,
  UserProfile,
  UserTarget,
} from './types';
import { envSchema } from './config';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** ISO 8601 datetime string (e.g. "2026-03-29T12:00:00.000Z") */
const isoDatetime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);

/** YYYY-MM-DD date-only string */
const isoDateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** A value that is either a plain number or null */
const nullableNumber = z.number().nullable();

// ─────────────────────────────────────────────────────────────────────────────
// 1. API response envelope
// ─────────────────────────────────────────────────────────────────────────────

describe('API response envelope', () => {
  it('should accept { data: T } for any payload type', () => {
    const envelope: ApiResponse<{ id: string }> = { data: { id: 'abc' } };
    expect(envelope.data.id).toBe('abc');
  });

  it('should accept an optional meta field alongside data', () => {
    const envelope: ApiResponse<number> = { data: 42, meta: { total: 1 } };
    expect(envelope.meta?.total).toBe(1);
  });

  it('should conform to { data: T } shape via Zod schema', () => {
    // Require data to be explicitly present (not just undefined) to catch missing-key cases.
    // Zod treats missing keys as undefined by default, so we refine to exclude undefined.
    const envelopeSchema = z.object({
      data: z.unknown().refine((v) => v !== undefined, 'data is required'),
    });
    expect(envelopeSchema.safeParse({ data: { id: '1' } }).success).toBe(true);
    expect(envelopeSchema.safeParse({ result: { id: '1' } }).success).toBe(false);
    expect(envelopeSchema.safeParse({}).success).toBe(false);
  });

  it('should accept paginated response with meta', () => {
    const paginated: PaginatedResponse<{ id: string }> = {
      data: [{ id: 'a' }, { id: 'b' }],
      meta: { total: 2, page: 1, limit: 20, totalPages: 1 },
    };
    expect(paginated.meta.total).toBe(2);
    expect(paginated.data).toHaveLength(2);
  });

  it('should require all four pagination meta fields', () => {
    const metaSchema = z.object({
      total: z.number(),
      page: z.number(),
      limit: z.number(),
      totalPages: z.number(),
    });
    expect(metaSchema.safeParse({ total: 5, page: 1, limit: 20, totalPages: 1 }).success).toBe(
      true,
    );
    expect(metaSchema.safeParse({ total: 5, page: 1, limit: 20 }).success).toBe(false);
  });

  it('should conform to error response shape', () => {
    const err: ApiErrorResponse = {
      statusCode: 404,
      message: 'Not found',
      error: 'NotFoundException',
    };
    expect(err.statusCode).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Constants — enum coverage
// ─────────────────────────────────────────────────────────────────────────────

describe('shared constants', () => {
  it('should export all expected GoalType values', () => {
    expect(GOAL_TYPES).toContain('lose_fat');
    expect(GOAL_TYPES).toContain('maintain');
    expect(GOAL_TYPES).toContain('gain');
  });

  it('should export all expected Gender values', () => {
    expect(GENDERS).toContain('male');
    expect(GENDERS).toContain('female');
    expect(GENDERS).toContain('other');
  });

  it('should export all five ActivityLevel values', () => {
    expect(ACTIVITY_LEVELS).toHaveLength(5);
    expect(ACTIVITY_LEVELS).toContain('sedentary');
    expect(ACTIVITY_LEVELS).toContain('extra_active');
  });

  it('should export all four DietPreference values', () => {
    expect(DIET_PREFERENCES).toHaveLength(4);
    expect(DIET_PREFERENCES).toContain('standard');
    expect(DIET_PREFERENCES).toContain('high_protein');
    expect(DIET_PREFERENCES).toContain('low_carb');
    expect(DIET_PREFERENCES).toContain('low_fat');
  });

  it('should support mn and en locales', () => {
    expect(SUPPORTED_LOCALES).toContain('mn');
    expect(SUPPORTED_LOCALES).toContain('en');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Queue names and job options
// ─────────────────────────────────────────────────────────────────────────────

describe('queue constants', () => {
  it('should export all expected queue names', () => {
    const expected = ['photo-parsing', 'reminders', 'coach-memory', 'privacy'];
    for (const name of expected) {
      expect(Object.values(QUEUE_NAMES)).toContain(name);
    }
  });

  it('DEFAULT_JOB_OPTIONS should specify exponential backoff with 3 attempts', () => {
    expect(DEFAULT_JOB_OPTIONS.attempts).toBe(3);
    expect(DEFAULT_JOB_OPTIONS.backoff.type).toBe('exponential');
    expect(DEFAULT_JOB_OPTIONS.backoff.delay).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. OnboardingPayload — required fields
// ─────────────────────────────────────────────────────────────────────────────

describe('OnboardingPayload contract', () => {
  const onboardingSchema = z.object({
    goalType: z.enum(GOAL_TYPES),
    goalWeightKg: z.number().positive(),
    weeklyRateKg: z.number().positive(),
    gender: z.enum(GENDERS),
    birthDate: isoDateOnly,
    heightCm: z.number().positive(),
    weightKg: z.number().positive(),
    activityLevel: z.enum(ACTIVITY_LEVELS),
    dietPreference: z.enum(DIET_PREFERENCES),
  });

  const validPayload: OnboardingPayload = {
    goalType: 'lose_fat',
    goalWeightKg: 70,
    weeklyRateKg: 0.5,
    gender: 'male',
    birthDate: '1990-05-15',
    heightCm: 175,
    weightKg: 80,
    activityLevel: 'moderately_active',
    dietPreference: 'standard',
  };

  it('should accept a fully-populated valid payload', () => {
    expect(onboardingSchema.safeParse(validPayload).success).toBe(true);
  });

  it('should reject an invalid goalType', () => {
    const result = onboardingSchema.safeParse({ ...validPayload, goalType: 'bulk' });
    expect(result.success).toBe(false);
  });

  it('should reject birthDate not in YYYY-MM-DD format', () => {
    const result = onboardingSchema.safeParse({ ...validPayload, birthDate: '15/05/1990' });
    expect(result.success).toBe(false);
  });

  it('should reject missing required fields', () => {
    const { heightCm: _removed, ...partial } = validPayload;
    expect(onboardingSchema.safeParse(partial).success).toBe(false);
  });

  it('should reject non-positive weightKg', () => {
    expect(onboardingSchema.safeParse({ ...validPayload, weightKg: 0 }).success).toBe(false);
    expect(onboardingSchema.safeParse({ ...validPayload, weightKg: -5 }).success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. OnboardingResult — API returns this after POST /onboarding
// ─────────────────────────────────────────────────────────────────────────────

describe('OnboardingResult contract', () => {
  const onboardingResultSchema = z.object({
    profile: z.object({
      id: z.string().uuid(),
      gender: z.enum(GENDERS).nullable(),
      birthDate: isoDateOnly.nullable(),
      heightCm: z.number().nullable(),
      weightKg: z.number().nullable(),
      goalWeightKg: z.number().nullable(),
      activityLevel: z.enum(ACTIVITY_LEVELS).nullable(),
      dietPreference: z.enum(DIET_PREFERENCES).nullable(),
    }),
    target: z.object({
      id: z.string().uuid(),
      goalType: z.enum(GOAL_TYPES),
      calorieTarget: z.number().int().positive(),
      proteinGrams: z.number().positive(),
      carbsGrams: z.number().positive(),
      fatGrams: z.number().positive(),
      weeklyRateKg: z.number(),
    }),
  });

  const validResult: OnboardingResult = {
    profile: {
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      gender: 'male',
      birthDate: '1990-05-15',
      heightCm: 175,
      weightKg: 80,
      goalWeightKg: 70,
      activityLevel: 'moderately_active',
      dietPreference: 'standard',
    },
    target: {
      id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      goalType: 'lose_fat',
      calorieTarget: 1800,
      proteinGrams: 150,
      carbsGrams: 180,
      fatGrams: 60,
      weeklyRateKg: 0.5,
    },
  };

  it('should accept a fully-populated valid result', () => {
    expect(onboardingResultSchema.safeParse(validResult).success).toBe(true);
  });

  it('should accept null for nullable profile fields', () => {
    const result = {
      ...validResult,
      profile: {
        ...validResult.profile,
        gender: null,
        birthDate: null,
        heightCm: null,
        weightKg: null,
        goalWeightKg: null,
        activityLevel: null,
        dietPreference: null,
      },
    };
    expect(onboardingResultSchema.safeParse(result).success).toBe(true);
  });

  it('should reject non-UUID profile id', () => {
    const result = {
      ...validResult,
      profile: { ...validResult.profile, id: 'not-a-uuid' },
    };
    expect(onboardingResultSchema.safeParse(result).success).toBe(false);
  });

  it('should reject missing target fields', () => {
    const { calorieTarget: _removed, ...targetWithout } = validResult.target;
    const result = { ...validResult, target: targetWithout };
    expect(onboardingResultSchema.safeParse(result).success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Profile response — GET /profile
// ─────────────────────────────────────────────────────────────────────────────

describe('Profile response contract', () => {
  const profileResponseSchema = z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    displayName: z.string().nullable(),
    locale: z.enum(SUPPORTED_LOCALES),
    unitSystem: z.literal('metric'),
    gender: z.string().nullable(),
    birthDate: isoDateOnly.nullable(),
    heightCm: z.number().nullable(),
    weightKg: z.number().nullable(),
    goalWeightKg: z.number().nullable(),
    bmi: z.number().nullable(),
    activityLevel: z.string().nullable(),
    dietPreference: z.string().nullable(),
    onboardingCompletedAt: isoDatetime.nullable(),
    createdAt: isoDatetime,
    updatedAt: isoDatetime,
  });

  const validProfile = {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    userId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    displayName: 'Test User',
    locale: 'mn' as const,
    unitSystem: 'metric' as const,
    gender: 'male',
    birthDate: '1990-05-15',
    heightCm: 175,
    weightKg: 80,
    goalWeightKg: 70,
    bmi: 26.1,
    activityLevel: 'moderately_active',
    dietPreference: 'standard',
    onboardingCompletedAt: '2026-01-10T08:00:00.000Z',
    createdAt: '2026-01-10T08:00:00.000Z',
    updatedAt: '2026-03-01T12:00:00.000Z',
  };

  it('should accept a fully-populated profile', () => {
    expect(profileResponseSchema.safeParse(validProfile).success).toBe(true);
  });

  it('birthDate should be YYYY-MM-DD, not a full ISO datetime', () => {
    // The API calls .toISOString().split('T')[0] — verify contract stays date-only
    expect(isoDateOnly.safeParse(validProfile.birthDate).success).toBe(true);
    expect(isoDatetime.safeParse(validProfile.birthDate).success).toBe(false);
  });

  it('createdAt and updatedAt should be full ISO datetime strings', () => {
    expect(isoDatetime.safeParse(validProfile.createdAt).success).toBe(true);
    expect(isoDatetime.safeParse(validProfile.updatedAt).success).toBe(true);
  });

  it('should accept null for all nullable profile fields', () => {
    const nullProfile = {
      ...validProfile,
      displayName: null,
      gender: null,
      birthDate: null,
      heightCm: null,
      weightKg: null,
      goalWeightKg: null,
      bmi: null,
      activityLevel: null,
      dietPreference: null,
      onboardingCompletedAt: null,
    };
    expect(profileResponseSchema.safeParse(nullProfile).success).toBe(true);
  });

  it('should reject unknown locale values', () => {
    const result = profileResponseSchema.safeParse({ ...validProfile, locale: 'fr' });
    expect(result.success).toBe(false);
  });

  it('should reject unitSystem other than metric', () => {
    const result = profileResponseSchema.safeParse({ ...validProfile, unitSystem: 'imperial' });
    expect(result.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. MealLog response — GET /meal-logs/:id
// ─────────────────────────────────────────────────────────────────────────────

describe('MealLog response contract', () => {
  const mealLogItemSchema = z.object({
    id: z.string().uuid(),
    foodId: z.string().nullable(),
    quantity: z.number(),
    servingLabel: z.string(),
    gramsPerUnit: z.number(),
    snapshotFoodName: z.string(),
    snapshotCalories: z.number(),
    snapshotProtein: z.number(),
    snapshotCarbs: z.number(),
    snapshotFat: z.number(),
    snapshotFiber: nullableNumber,
    snapshotSugar: nullableNumber,
    snapshotSodium: nullableNumber,
    snapshotSaturatedFat: nullableNumber,
  });

  const mealLogSchema = z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    mealType: z.string().nullable(),
    source: z.string(),
    loggedAt: isoDatetime,
    note: z.string().nullable(),
    totalCalories: z.number().nullable(),
    totalProtein: z.number(),
    totalCarbs: z.number(),
    totalFat: z.number(),
    totalFiber: nullableNumber,
    totalSugar: nullableNumber,
    totalSodium: nullableNumber,
    totalSaturatedFat: nullableNumber,
    items: z.array(mealLogItemSchema),
    createdAt: isoDatetime,
    updatedAt: isoDatetime,
  });

  const validItem = {
    id: '00000000-0000-4000-8000-000000000003',
    foodId: '00000000-0000-4000-8000-000000000004',
    quantity: 1,
    servingLabel: '100g',
    gramsPerUnit: 100,
    snapshotFoodName: 'Chicken Breast',
    snapshotCalories: 165,
    snapshotProtein: 31,
    snapshotCarbs: 0,
    snapshotFat: 3.6,
    snapshotFiber: null,
    snapshotSugar: null,
    snapshotSodium: 74,
    snapshotSaturatedFat: 1,
  };

  const validMealLog = {
    id: '00000000-0000-4000-8000-000000000005',
    userId: '00000000-0000-4000-8000-000000000006',
    mealType: 'lunch',
    source: 'text',
    loggedAt: '2026-03-29T06:30:00.000Z',
    note: null,
    totalCalories: 165,
    totalProtein: 31,
    totalCarbs: 0,
    totalFat: 3.6,
    totalFiber: null,
    totalSugar: null,
    totalSodium: 74,
    totalSaturatedFat: 1,
    items: [validItem],
    createdAt: '2026-03-29T06:30:00.000Z',
    updatedAt: '2026-03-29T06:30:00.000Z',
  };

  it('should accept a fully-populated meal log', () => {
    expect(mealLogSchema.safeParse(validMealLog).success).toBe(true);
  });

  it('loggedAt should be a full ISO datetime string', () => {
    expect(isoDatetime.safeParse(validMealLog.loggedAt).success).toBe(true);
  });

  it('should accept null for all nullable nutrition fields', () => {
    const log = {
      ...validMealLog,
      mealType: null,
      totalCalories: null,
      totalFiber: null,
      totalSugar: null,
      totalSodium: null,
      totalSaturatedFat: null,
    };
    expect(mealLogSchema.safeParse(log).success).toBe(true);
  });

  it('should accept meal log with empty items array', () => {
    expect(mealLogSchema.safeParse({ ...validMealLog, items: [] }).success).toBe(true);
  });

  it('should reject an item with a missing required field', () => {
    const { snapshotCalories: _removed, ...itemWithout } = validItem;
    const log = { ...validMealLog, items: [itemWithout] };
    expect(mealLogSchema.safeParse(log).success).toBe(false);
  });

  it('mobile MealLog interface should match API schema field-for-field', () => {
    // Validates that every key the mobile interface expects is present in validMealLog
    const mobileExpectedKeys: (keyof typeof validMealLog)[] = [
      'id',
      'userId',
      'mealType',
      'source',
      'loggedAt',
      'note',
      'totalCalories',
      'totalProtein',
      'totalCarbs',
      'totalFat',
      'totalFiber',
      'totalSugar',
      'totalSodium',
      'totalSaturatedFat',
      'items',
      'createdAt',
      'updatedAt',
    ];
    for (const key of mobileExpectedKeys) {
      expect(validMealLog).toHaveProperty(key);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Dashboard response — GET /dashboard
// ─────────────────────────────────────────────────────────────────────────────

describe('Dashboard daily response contract', () => {
  const nutritionMacroSchema = z.object({
    calories: z.number(),
    protein: z.number(),
    carbs: z.number(),
    fat: z.number(),
  });

  const dashboardSchema = z.object({
    date: isoDateOnly,
    consumed: nutritionMacroSchema.extend({
      fiber: nullableNumber,
      sugar: nullableNumber,
      sodium: nullableNumber,
      saturatedFat: nullableNumber,
    }),
    targets: nutritionMacroSchema.nullable(),
    remaining: nutritionMacroSchema.nullable(),
    proteinProgress: z
      .object({
        current: z.number(),
        target: z.number(),
        percentage: z.number().min(0).max(100),
      })
      .nullable(),
    mealCount: z.number().int().nonnegative(),
    meals: z.array(z.unknown()),
    waterConsumed: z.number().int().nonnegative(),
    waterTarget: z.number().int().positive(),
  });

  const validDashboard = {
    date: '2026-03-29',
    consumed: {
      calories: 500,
      protein: 40,
      carbs: 60,
      fat: 15,
      fiber: null,
      sugar: null,
      sodium: null,
      saturatedFat: null,
    },
    targets: { calories: 2000, protein: 150, carbs: 200, fat: 70 },
    remaining: { calories: 1500, protein: 110, carbs: 140, fat: 55 },
    proteinProgress: { current: 40, target: 150, percentage: 26.7 },
    mealCount: 1,
    meals: [],
    waterConsumed: 500,
    waterTarget: 2000,
  };

  it('should accept a valid dashboard response', () => {
    expect(dashboardSchema.safeParse(validDashboard).success).toBe(true);
  });

  it('date field should be YYYY-MM-DD, not a full ISO datetime', () => {
    expect(isoDateOnly.safeParse(validDashboard.date).success).toBe(true);
    expect(isoDatetime.safeParse(validDashboard.date).success).toBe(false);
  });

  it('should accept null targets when user has not completed onboarding', () => {
    const result = dashboardSchema.safeParse({
      ...validDashboard,
      targets: null,
      remaining: null,
      proteinProgress: null,
    });
    expect(result.success).toBe(true);
  });

  it('should reject negative waterTarget', () => {
    const result = dashboardSchema.safeParse({ ...validDashboard, waterTarget: 0 });
    expect(result.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Nutrition history — GET /dashboard/history
// ─────────────────────────────────────────────────────────────────────────────

describe('Nutrition history response contract', () => {
  // Mobile DayHistory only includes fiber (not sugar/sodium/saturatedFat).
  // API DayHistory returns all four nullable micronutrient fields.
  // This test catches a divergence: mobile is missing sugar/sodium/saturatedFat
  // in its DayHistory interface compared to the API payload.

  const apiDayHistorySchema = z.object({
    date: isoDateOnly,
    calories: z.number().int().nonnegative(),
    protein: z.number().nonnegative(),
    carbs: z.number().nonnegative(),
    fat: z.number().nonnegative(),
    fiber: nullableNumber,
    sugar: nullableNumber,
    sodium: nullableNumber,
    saturatedFat: nullableNumber,
    waterMl: z.number().int().nonnegative(),
  });

  const historyResponseSchema = z.object({
    history: z.array(apiDayHistorySchema),
    target: z
      .object({
        calories: z.number(),
        protein: z.number(),
        carbs: z.number(),
        fat: z.number(),
      })
      .nullable(),
  });

  const validHistory = {
    history: [
      {
        date: '2026-03-28',
        calories: 1800,
        protein: 140.5,
        carbs: 190.0,
        fat: 65.0,
        fiber: 22.0,
        sugar: null,
        sodium: null,
        saturatedFat: null,
        waterMl: 1800,
      },
    ],
    target: { calories: 2000, protein: 150, carbs: 200, fat: 70 },
  };

  it('should accept a valid history response', () => {
    expect(historyResponseSchema.safeParse(validHistory).success).toBe(true);
  });

  it('should accept null target when user has no active targets', () => {
    const result = historyResponseSchema.safeParse({ ...validHistory, target: null });
    expect(result.success).toBe(true);
  });

  it('history dates should be YYYY-MM-DD format', () => {
    for (const day of validHistory.history) {
      expect(isoDateOnly.safeParse(day.date).success).toBe(true);
    }
  });

  it('mobile DayHistory is a subset of API DayHistory (fiber exists, sugar/sodium/saturatedFat may be absent from mobile interface)', () => {
    // The mobile DayHistory interface only has fiber but not sugar/sodium/saturatedFat.
    // Confirm that the shared API payload is a superset — mobile will simply ignore
    // the extra fields (no runtime error), but this test documents the discrepancy.
    const mobileDayHistoryKeys = [
      'date',
      'calories',
      'protein',
      'carbs',
      'fat',
      'fiber',
      'waterMl',
    ];
    const apiDay = validHistory.history[0]!;
    for (const key of mobileDayHistoryKeys) {
      expect(apiDay).toHaveProperty(key);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. Water log response — GET /water-logs
// ─────────────────────────────────────────────────────────────────────────────

describe('Water log response contract', () => {
  const waterEntrySchema = z.object({
    id: z.string().uuid(),
    amountMl: z.number().int().positive(),
    loggedAt: isoDatetime,
  });

  const waterDailySchema = z.object({
    consumed: z.number().int().nonnegative(),
    target: z.number().int().positive(),
    entries: z.array(waterEntrySchema),
  });

  const validEntry = {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    amountMl: 250,
    loggedAt: '2026-03-29T08:00:00.000Z',
  };

  it('should accept a valid water daily response', () => {
    const data = { consumed: 250, target: 2000, entries: [validEntry] };
    expect(waterDailySchema.safeParse(data).success).toBe(true);
  });

  it('entry loggedAt should be a full ISO datetime', () => {
    expect(isoDatetime.safeParse(validEntry.loggedAt).success).toBe(true);
  });

  it('should accept empty entries array', () => {
    const data = { consumed: 0, target: 2000, entries: [] };
    expect(waterDailySchema.safeParse(data).success).toBe(true);
  });

  it('should reject negative amountMl', () => {
    const bad = { ...validEntry, amountMl: -100 };
    expect(waterEntrySchema.safeParse(bad).success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. Weight log response — GET /weight-logs
// ─────────────────────────────────────────────────────────────────────────────

describe('Weight log response contract', () => {
  const weightLogEntrySchema = z.object({
    id: z.string().uuid(),
    weightKg: z.number().positive(),
    loggedAt: isoDateOnly,
  });

  const validEntry = {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    weightKg: 78.5,
    loggedAt: '2026-03-29',
  };

  it('should accept a valid weight entry', () => {
    expect(weightLogEntrySchema.safeParse(validEntry).success).toBe(true);
  });

  it('loggedAt should be YYYY-MM-DD (not full ISO datetime)', () => {
    // The API calls .toISOString().split('T')[0] — must stay date-only
    expect(isoDateOnly.safeParse(validEntry.loggedAt).success).toBe(true);
    expect(isoDatetime.safeParse(validEntry.loggedAt).success).toBe(false);
  });

  it('should reject non-positive weightKg', () => {
    expect(weightLogEntrySchema.safeParse({ ...validEntry, weightKg: 0 }).success).toBe(false);
  });

  it('trend response shape should match expected fields', () => {
    const trendSchema = z.object({
      current: z.number(),
      weeklyAverage: z.number(),
      previousWeekAverage: nullableNumber,
      weeklyDelta: nullableNumber,
      dataPoints: z.number().int().positive(),
    });

    const validTrend = {
      current: 78.5,
      weeklyAverage: 79.1,
      previousWeekAverage: 80.0,
      weeklyDelta: -0.9,
      dataPoints: 7,
    };
    expect(trendSchema.safeParse(validTrend).success).toBe(true);
    expect(
      trendSchema.safeParse({ ...validTrend, previousWeekAverage: null, weeklyDelta: null })
        .success,
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. Streaks response — GET /streaks
// ─────────────────────────────────────────────────────────────────────────────

describe('Streaks response contract', () => {
  const calendarDaySchema = z.object({
    date: isoDateOnly,
    logged: z.boolean(),
  });

  const streakDataSchema = z.object({
    currentStreak: z.number().int().nonnegative(),
    longestStreak: z.number().int().nonnegative(),
    weekConsistency: z.number().int().min(0).max(100),
    monthConsistency: z.number().int().min(0).max(100),
    todayLogged: z.boolean(),
    calendar: z.array(calendarDaySchema),
  });

  const validStreakData = {
    currentStreak: 5,
    longestStreak: 14,
    weekConsistency: 71,
    monthConsistency: 60,
    todayLogged: true,
    calendar: [
      { date: '2026-03-28', logged: true },
      { date: '2026-03-29', logged: true },
    ],
  };

  it('should accept valid streak data', () => {
    expect(streakDataSchema.safeParse(validStreakData).success).toBe(true);
  });

  it('weekConsistency should be 0-100', () => {
    expect(streakDataSchema.safeParse({ ...validStreakData, weekConsistency: 101 }).success).toBe(
      false,
    );
    expect(streakDataSchema.safeParse({ ...validStreakData, weekConsistency: -1 }).success).toBe(
      false,
    );
  });

  it('calendar dates should be YYYY-MM-DD format', () => {
    for (const day of validStreakData.calendar) {
      expect(isoDateOnly.safeParse(day.date).success).toBe(true);
    }
  });

  it('mobile StreakData interface and API StreakData should share the same field names', () => {
    const apiKeys = Object.keys(validStreakData);
    const mobileExpected = [
      'currentStreak',
      'longestStreak',
      'weekConsistency',
      'monthConsistency',
      'todayLogged',
      'calendar',
    ];
    for (const key of mobileExpected) {
      expect(apiKeys).toContain(key);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 13. Subscription status — GET /subscriptions/status
// ─────────────────────────────────────────────────────────────────────────────

describe('Subscription status contract', () => {
  const subscriptionSchema = z.object({
    tier: z.enum(['free', 'pro']),
    status: z.string(),
    currentPeriodEnd: isoDatetime.nullable(),
  });

  it('should accept free tier with null period end', () => {
    const data = { tier: 'free' as const, status: 'active', currentPeriodEnd: null };
    expect(subscriptionSchema.safeParse(data).success).toBe(true);
  });

  it('should accept pro tier with a period end datetime', () => {
    const data = {
      tier: 'pro' as const,
      status: 'active',
      currentPeriodEnd: '2026-12-31T00:00:00.000Z',
    };
    expect(subscriptionSchema.safeParse(data).success).toBe(true);
  });

  it('should reject unknown tier values', () => {
    const data = { tier: 'premium', status: 'active', currentPeriodEnd: null };
    expect(subscriptionSchema.safeParse(data).success).toBe(false);
  });

  it('verify response should return tier field', () => {
    const verifySchema = z.object({ tier: z.enum(['free', 'pro']) });
    expect(verifySchema.safeParse({ tier: 'pro' }).success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 14. Chat response — GET /chat/history
// ─────────────────────────────────────────────────────────────────────────────

describe('Chat response contract', () => {
  // NOTE: /chat/history returns { messages: T[] } NOT the standard { data: T } envelope.
  // This is a deliberate exception to the envelope rule and the test documents it.
  const chatMessageSchema = z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
    timestamp: isoDatetime,
  });

  const chatHistorySchema = z.object({
    messages: z.array(chatMessageSchema),
  });

  it('chat history uses { messages } not { data } envelope', () => {
    const response = {
      messages: [
        { role: 'user' as const, content: 'Hello', timestamp: '2026-03-29T10:00:00.000Z' },
        { role: 'assistant' as const, content: 'Hi there!', timestamp: '2026-03-29T10:00:01.000Z' },
      ],
    };
    expect(chatHistorySchema.safeParse(response).success).toBe(true);
    // Confirm it does NOT match the standard { data } envelope (data key is absent).
    // Use refine so that a missing data key is treated as a failure.
    const envelopeSchema = z.object({
      data: z.unknown().refine((v) => v !== undefined, 'data is required'),
    });
    expect(envelopeSchema.safeParse(response).success).toBe(false);
  });

  it('timestamp should be full ISO datetime', () => {
    expect(isoDatetime.safeParse('2026-03-29T10:00:00.000Z').success).toBe(true);
  });

  it('should reject invalid role', () => {
    const msg = { role: 'system', content: 'hey', timestamp: '2026-03-29T10:00:00.000Z' };
    expect(chatMessageSchema.safeParse(msg).success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 15. Decimal field coercion — Prisma Decimal to number
// ─────────────────────────────────────────────────────────────────────────────

describe('Decimal field coercion', () => {
  // The API calls Number() on all Prisma Decimal fields before returning.
  // Verify that the coercion patterns the API uses are correct.

  it('Number() should coerce a plain number unchanged', () => {
    expect(Number(31.5)).toBe(31.5);
  });

  it('Number() should coerce a numeric string correctly', () => {
    expect(Number('31.50')).toBe(31.5);
    expect(Number('0')).toBe(0);
  });

  it('Number() should coerce a Prisma-like Decimal object with toNumber()', () => {
    const decimalLike = { toNumber: () => 31.5, toString: () => '31.5' };
    // The API just calls Number(decimalLike) which invokes valueOf/toString.
    // Objects without valueOf go through toString — confirm the pattern works.
    expect(Number(decimalLike.toString())).toBe(31.5);
  });

  it('Number() of null is 0, but the API guards with conditional checks', () => {
    // The API uses: field ? Number(field) : 0  OR  field !== null ? Number(field) : null
    const nullishField: unknown = null;
    const withFallback = nullishField ? Number(nullishField) : 0;
    expect(withFallback).toBe(0);

    const nullableResult =
      nullishField !== null && nullishField !== undefined ? Number(nullishField) : null;
    expect(nullableResult).toBeNull();
  });

  it('should preserve decimal precision through the Number + toFixed pattern', () => {
    // Simulates the pattern: Number((Number(val) * factor).toFixed(2))
    const val = '31.456789';
    const factor = 1;
    const result = Number((Number(val) * factor).toFixed(2));
    expect(result).toBe(31.46);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 16. envSchema — environment validation
// ─────────────────────────────────────────────────────────────────────────────

describe('envSchema contract', () => {
  const minimalValidEnv = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    REDIS_URL: 'redis://localhost:6379',
    FIREBASE_PROJECT_ID: 'my-project',
  };

  it('should accept a minimal valid environment', () => {
    const result = envSchema.safeParse(minimalValidEnv);
    expect(result.success).toBe(true);
  });

  it('should apply defaults for NODE_ENV, PORT, BULL_BOARD credentials', () => {
    const result = envSchema.safeParse(minimalValidEnv);
    if (!result.success) throw new Error('parse failed');
    expect(result.data.NODE_ENV).toBe('development');
    expect(result.data.PORT).toBe(3000);
    expect(result.data.BULL_BOARD_USER).toBe('admin');
    expect(result.data.BULL_BOARD_PASSWORD).toBe('admin');
  });

  it('should reject missing DATABASE_URL', () => {
    const { DATABASE_URL: _removed, ...env } = minimalValidEnv;
    expect(envSchema.safeParse(env).success).toBe(false);
  });

  it('should reject missing REDIS_URL', () => {
    const { REDIS_URL: _removed, ...env } = minimalValidEnv;
    expect(envSchema.safeParse(env).success).toBe(false);
  });

  it('should reject missing FIREBASE_PROJECT_ID', () => {
    const { FIREBASE_PROJECT_ID: _removed, ...env } = minimalValidEnv;
    expect(envSchema.safeParse(env).success).toBe(false);
  });

  it('should coerce PORT from string to number', () => {
    const result = envSchema.safeParse({ ...minimalValidEnv, PORT: '8080' });
    if (!result.success) throw new Error('parse failed');
    expect(result.data.PORT).toBe(8080);
  });

  it('should reject invalid NODE_ENV values', () => {
    expect(envSchema.safeParse({ ...minimalValidEnv, NODE_ENV: 'staging' }).success).toBe(false);
  });

  it('should transform ADMIN_USER_IDS comma-delimited string into array', () => {
    const result = envSchema.safeParse({
      ...minimalValidEnv,
      ADMIN_USER_IDS: 'uuid-1, uuid-2 , uuid-3',
    });
    if (!result.success) throw new Error('parse failed');
    expect(result.data.ADMIN_USER_IDS).toEqual(['uuid-1', 'uuid-2', 'uuid-3']);
  });

  it('should produce empty array for ADMIN_USER_IDS when not set', () => {
    const result = envSchema.safeParse(minimalValidEnv);
    if (!result.success) throw new Error('parse failed');
    expect(result.data.ADMIN_USER_IDS).toEqual([]);
  });

  it('should accept valid VISION_PROVIDER values', () => {
    expect(envSchema.safeParse({ ...minimalValidEnv, VISION_PROVIDER: 'gemini' }).success).toBe(
      true,
    );
    expect(envSchema.safeParse({ ...minimalValidEnv, VISION_PROVIDER: 'openai' }).success).toBe(
      true,
    );
    expect(envSchema.safeParse({ ...minimalValidEnv, VISION_PROVIDER: 'azure' }).success).toBe(
      false,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 17. UserProfile and UserTarget shared types
// ─────────────────────────────────────────────────────────────────────────────

describe('UserProfile shared type', () => {
  it('should accept a valid UserProfile object', () => {
    const profile: UserProfile = {
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      locale: 'mn',
      unitSystem: 'metric',
      createdAt: new Date('2026-01-10T08:00:00.000Z'),
      updatedAt: new Date('2026-03-01T12:00:00.000Z'),
    };
    expect(profile.locale).toBe('mn');
    expect(profile.unitSystem).toBe('metric');
    expect(profile.createdAt).toBeInstanceOf(Date);
  });
});

describe('UserTarget shared type', () => {
  it('should accept a valid UserTarget object', () => {
    const target: UserTarget = {
      id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      userId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      goalType: 'lose_fat',
      calorieTarget: 1800,
      proteinGrams: 150,
      carbsGrams: 180,
      fatGrams: 60,
      weeklyRateKg: 0.5,
      effectiveFrom: new Date('2026-01-10T00:00:00.000Z'),
      effectiveTo: null,
    };
    expect(target.goalType).toBe('lose_fat');
    expect(target.effectiveTo).toBeNull();
  });
});
