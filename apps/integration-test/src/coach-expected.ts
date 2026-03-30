/**
 * Test fixtures for coach message, weekly report, and coach memory integration tests.
 */
import { CoachContext, CoachMessageType, WeeklyReportData } from './coach-helpers';

// ── Coach message test cases ─────────────────────────────────────────────────

export interface CoachTestCase {
  label: string;
  context: CoachContext;
  memoryBlock?: string;
  /** Max sentence count (approximate — counted by periods) */
  maxSentences: number;
  /** Substrings that should appear in the message (case-insensitive) */
  shouldMention?: string[];
  /** Expected language */
  locale: 'mn' | 'en';
}

function makeContext(
  overrides: Partial<CoachContext> & { messageType: CoachMessageType },
): CoachContext {
  return {
    userName: 'Болд',
    locale: 'mn',
    localTime: '08:30',
    today: {
      mealsLogged: 2,
      caloriesConsumed: 1200,
      caloriesTarget: 2000,
      proteinConsumed: 45,
      proteinTarget: 120,
      carbsConsumed: 150,
      fatConsumed: 40,
      waterMl: 800,
      waterTarget: 2500,
      mealTypes: ['breakfast', 'lunch'],
    },
    streak: { mealLoggingDays: 5, waterGoalDays: 3 },
    weekly: {
      avgDailyCalories: 1800,
      avgMealsPerDay: 2.5,
      daysWithWaterGoalMet: 4,
      totalDays: 7,
    },
    ...overrides,
  };
}

export const COACH_TEST_CASES: CoachTestCase[] = [
  {
    label: 'Morning greeting (Mongolian)',
    context: makeContext({
      messageType: 'morning_greeting',
      localTime: '07:30',
      today: {
        mealsLogged: 0,
        caloriesConsumed: 0,
        caloriesTarget: 2000,
        proteinConsumed: 0,
        proteinTarget: 120,
        carbsConsumed: 0,
        fatConsumed: 0,
        waterMl: 0,
        waterTarget: 2500,
        mealTypes: [],
      },
    }),
    maxSentences: 5,
    shouldMention: ['Болд'],
    locale: 'mn',
  },
  {
    label: 'Water reminder (low intake)',
    context: makeContext({
      messageType: 'water_reminder',
      localTime: '14:00',
      today: {
        mealsLogged: 2,
        caloriesConsumed: 1200,
        caloriesTarget: 2000,
        proteinConsumed: 45,
        proteinTarget: 120,
        carbsConsumed: 150,
        fatConsumed: 40,
        waterMl: 400,
        waterTarget: 2500,
        mealTypes: ['breakfast', 'lunch'],
      },
    }),
    maxSentences: 5,
    shouldMention: ['400'],
    locale: 'mn',
  },
  {
    label: 'Progress feedback (good day)',
    context: makeContext({
      messageType: 'progress_feedback',
      localTime: '20:00',
      today: {
        mealsLogged: 3,
        caloriesConsumed: 1950,
        caloriesTarget: 2000,
        proteinConsumed: 115,
        proteinTarget: 120,
        carbsConsumed: 200,
        fatConsumed: 60,
        waterMl: 2400,
        waterTarget: 2500,
        mealTypes: ['breakfast', 'lunch', 'dinner'],
      },
    }),
    maxSentences: 7,
    shouldMention: ['1950'],
    locale: 'mn',
  },
  {
    label: 'Progress feedback (poor day)',
    context: makeContext({
      messageType: 'progress_feedback',
      localTime: '21:00',
      today: {
        mealsLogged: 1,
        caloriesConsumed: 500,
        caloriesTarget: 2000,
        proteinConsumed: 15,
        proteinTarget: 120,
        carbsConsumed: 60,
        fatConsumed: 20,
        waterMl: 300,
        waterTarget: 2500,
        mealTypes: ['lunch'],
      },
      streak: { mealLoggingDays: 0, waterGoalDays: 0 },
    }),
    maxSentences: 7,
    locale: 'mn',
  },
  {
    label: 'Streak celebration (7 days)',
    context: makeContext({
      messageType: 'streak_celebration',
      streak: { mealLoggingDays: 7, waterGoalDays: 5 },
    }),
    maxSentences: 7,
    shouldMention: ['7'],
    locale: 'mn',
  },
  {
    label: 'English locale morning greeting',
    context: makeContext({
      messageType: 'morning_greeting',
      locale: 'en',
      userName: 'Bold',
      localTime: '07:00',
    }),
    maxSentences: 5,
    shouldMention: ['Bold'],
    locale: 'en',
  },
  {
    label: 'Meal nudge (no meals logged)',
    context: makeContext({
      messageType: 'meal_nudge',
      localTime: '12:30',
      today: {
        mealsLogged: 0,
        caloriesConsumed: 0,
        caloriesTarget: 2000,
        proteinConsumed: 0,
        proteinTarget: 120,
        carbsConsumed: 0,
        fatConsumed: 0,
        waterMl: 500,
        waterTarget: 2500,
        mealTypes: [],
      },
    }),
    maxSentences: 5,
    locale: 'mn',
  },
];

// ── Weekly report test cases ─────────────────────────────────────────────────

export interface WeeklyReportTestCase {
  label: string;
  report: WeeklyReportData;
  userName: string | null;
  locale: string;
  memoryBlock?: string;
  shouldMention?: string[];
}

export const WEEKLY_REPORT_TEST_CASES: WeeklyReportTestCase[] = [
  {
    label: 'Great week (high adherence)',
    report: {
      weekStart: '2026-03-22',
      weekEnd: '2026-03-28',
      daysLogged: 7,
      averageCalories: 1950,
      averageProtein: 110,
      calorieTarget: 2000,
      proteinTarget: 120,
      adherenceScore: 95,
      weightDelta: -0.5,
      endOfWeekStreak: 7,
    },
    userName: 'Болд',
    locale: 'mn',
    shouldMention: ['7', '1950'],
  },
  {
    label: 'Inconsistent week (low logging)',
    report: {
      weekStart: '2026-03-22',
      weekEnd: '2026-03-28',
      daysLogged: 3,
      averageCalories: 2400,
      averageProtein: 60,
      calorieTarget: 2000,
      proteinTarget: 120,
      adherenceScore: 40,
      weightDelta: 0.3,
      endOfWeekStreak: 1,
    },
    userName: 'Тэмүүжин',
    locale: 'mn',
    shouldMention: ['3'],
  },
  {
    label: 'Weight loss stall',
    report: {
      weekStart: '2026-03-22',
      weekEnd: '2026-03-28',
      daysLogged: 6,
      averageCalories: 1800,
      averageProtein: 95,
      calorieTarget: 1800,
      proteinTarget: 100,
      adherenceScore: 85,
      weightDelta: 0.0,
      endOfWeekStreak: 4,
    },
    userName: null,
    locale: 'mn',
  },
  {
    label: 'English locale report',
    report: {
      weekStart: '2026-03-22',
      weekEnd: '2026-03-28',
      daysLogged: 5,
      averageCalories: 2100,
      averageProtein: 85,
      calorieTarget: 2200,
      proteinTarget: 100,
      adherenceScore: 70,
      weightDelta: -1.0,
      endOfWeekStreak: 5,
    },
    userName: 'Bold',
    locale: 'en',
    shouldMention: ['Bold', '5'],
  },
];

// ── Coach memory test cases ──────────────────────────────────────────────────

export interface MemoryTestCase {
  label: string;
  dataBlock: string;
}

export const MEMORY_TEST_CASES: MemoryTestCase[] = [
  {
    label: 'Active user with Mongolian foods',
    dataBlock: `Period: last 30 days
Days logged: 25/30
Top foods: бууз (18x), цуйван (12x), талх (10x), банан (8x), өндөг (7x), суутэй цай (6x), будаатай хуурга (5x), хуушуур (4x), салат (3x), yogurt (3x)
Avg calories by day of week: Mon: 1850 kcal, Tue: 2100 kcal, Wed: 1900 kcal, Thu: 1800 kcal, Fri: 2300 kcal, Sat: 2500 kcal, Sun: 2200 kcal
Protein: weekday avg 85g protein, weekend avg 65g protein
Meal types: lunch (40x), dinner (35x), breakfast (20x), snack (10x)
Weight: 82.5kg → 81.0kg (-1.5kg change)
Profile: name: Болд, goal: lose_fat, goal weight: 75kg, calorie target: 2000 kcal/day, protein target: 120g/day`,
  },
  {
    label: 'New user with minimal data',
    dataBlock: `Period: last 30 days
Days logged: 5/30
Top foods: pizza (3x), KFC chicken (2x), cola (2x)
Avg calories by day of week: Mon: 2500 kcal, Wed: 2800 kcal, Fri: 3000 kcal
Protein: weekday avg 40g protein
Meal types: lunch (3x), dinner (4x)
Weight: no weight data
Profile: name: Анхаа, goal: lose_fat, calorie target: 1800 kcal/day, protein target: 90g/day`,
  },
];
