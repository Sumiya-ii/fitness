/**
 * Test fixtures for notification delivery and meal timing integration tests.
 */
import { MealTimingInsights } from './notification-helpers';

// ── Telegram delivery test cases ────────────────────────────────────────────────

export interface TelegramDeliveryTestCase {
  label: string;
  text: string;
  parseMode?: 'Markdown' | 'HTML';
  /** If true, the message should be delivered successfully */
  expectSuccess: boolean;
}

export const TELEGRAM_DELIVERY_CASES: TelegramDeliveryTestCase[] = [
  {
    label: 'Plain text reminder',
    text: 'Өглөөний мэнд! 🌅 Шинэ өдөр, шинэ боломж. Өглөөний цайгаа юу болгох вэ?',
    expectSuccess: true,
  },
  {
    label: 'Markdown coach message',
    text: '*Өнөөдрийн дүгнэлт 📊*\n\nТа өнөөдөр 1950/2000 ккал идсэн — маш сайн! Уураг 115g хүрсэн. Маргааш ч ингэцгээе 💪',
    parseMode: 'Markdown',
    expectSuccess: true,
  },
  {
    label: 'English notification',
    text: 'Good morning, Bold! 🌅 New day, fresh start. You logged 3 meals yesterday — keep it up!',
    expectSuccess: true,
  },
  {
    label: 'Adaptive target notification',
    text: "Coach adjusted your target 📈\nGreat progress, but let's slow down a bit to protect muscle. Daily target increased by 150 kcal to 2150 kcal. Sustainable wins.",
    expectSuccess: true,
  },
  {
    label: 'Meal nudge',
    text: 'Оройн хоолонд юу идсэн бэ? 🍜 Өнөөдөр нэг л хоол бүртгэгдсэн. Оройн хоолоо нэмэх үү?',
    expectSuccess: true,
  },
];

// ── Expo Push test cases ────────────────────────────────────────────────────────

export interface ExpoPushTestCase {
  label: string;
  tokens: string[];
  title: string;
  body: string;
  data: Record<string, unknown>;
  /** Whether all tokens should result in errors (invalid tokens) */
  expectAllErrors: boolean;
}

export const EXPO_PUSH_CASES: ExpoPushTestCase[] = [
  {
    label: 'Invalid Expo token (DeviceNotRegistered)',
    tokens: ['ExponentPushToken[INVALID_TOKEN_FOR_TESTING]'],
    title: 'Test notification',
    body: 'This should fail gracefully',
    data: { type: 'test' },
    expectAllErrors: true,
  },
  {
    label: 'Malformed token format',
    tokens: ['not-a-valid-token'],
    title: 'Test notification',
    body: 'This should also fail gracefully',
    data: { type: 'test' },
    expectAllErrors: true,
  },
];

// ── Meal timing insight test cases ──────────────────────────────────────────────

export interface MealTimingTestCase {
  label: string;
  insights: MealTimingInsights;
  userName: string | null;
  locale: string;
  shouldMention?: string[];
}

export const MEAL_TIMING_CASES: MealTimingTestCase[] = [
  {
    label: 'Breakfast skipper (Mongolian)',
    insights: {
      weekStart: '2026-03-23',
      weekEnd: '2026-03-29',
      mealStats: [
        { mealType: 'breakfast', avgHour: 9.5, count: 2 },
        { mealType: 'lunch', avgHour: 13.0, count: 6 },
        { mealType: 'dinner', avgHour: 19.5, count: 5 },
        { mealType: 'snack', avgHour: 16.0, count: 3 },
      ],
      breakfastWeekdayRate: 20,
      breakfastWeekendRate: 50,
      lateNightEatingDays: 1,
      avgEatingWindowMinutes: 600,
      highlights: [
        'Та ажлын өдрүүдийн зөвхөн 20%-д өглөөний хоол идсэн байна.',
        'Таны өдрийн хоол идэх цонх дунджаар 10 цаг байна.',
      ],
    },
    userName: 'Болд',
    locale: 'mn',
    shouldMention: ['20%'],
  },
  {
    label: 'Late-night eater (Mongolian)',
    insights: {
      weekStart: '2026-03-23',
      weekEnd: '2026-03-29',
      mealStats: [
        { mealType: 'breakfast', avgHour: 8.0, count: 5 },
        { mealType: 'lunch', avgHour: 12.5, count: 7 },
        { mealType: 'dinner', avgHour: 21.5, count: 6 },
        { mealType: 'snack', avgHour: 22.0, count: 4 },
      ],
      breakfastWeekdayRate: 80,
      breakfastWeekendRate: 50,
      lateNightEatingDays: 5,
      avgEatingWindowMinutes: 840,
      highlights: [
        'Та ажлын өдрүүдийн 80%-д өглөөний хоолоо цагтаа идсэн байна.',
        '7 хоногийн 5 өдөр шөнийн 20:00-аас хойш хоол идсэн байна.',
        'Таны өдрийн хоол идэх цонх дунджаар 14 цаг байна — бага зэрэг богиносговол ашигтай.',
      ],
    },
    userName: 'Тэмүүжин',
    locale: 'mn',
    shouldMention: ['5'],
  },
  {
    label: 'Healthy pattern (English)',
    insights: {
      weekStart: '2026-03-23',
      weekEnd: '2026-03-29',
      mealStats: [
        { mealType: 'breakfast', avgHour: 7.5, count: 7 },
        { mealType: 'lunch', avgHour: 12.0, count: 7 },
        { mealType: 'dinner', avgHour: 18.5, count: 7 },
      ],
      breakfastWeekdayRate: 100,
      breakfastWeekendRate: 100,
      lateNightEatingDays: 0,
      avgEatingWindowMinutes: 660,
      highlights: [
        'Та ажлын өдрүүдийн 100%-д өглөөний хоолоо цагтаа идсэн байна.',
        'Таны өдрийн хоол идэх цонх дунджаар 11 цаг байна.',
      ],
    },
    userName: 'Bold',
    locale: 'en',
    shouldMention: ['100%'],
  },
];
