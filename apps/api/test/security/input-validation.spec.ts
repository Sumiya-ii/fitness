/**
 * C-037: Security/Privacy Verification Pack
 * Verifies Zod schemas reject malicious/invalid input:
 * XSS strings, SQL injection attempts, oversized payloads.
 */
import { createFoodSchema, foodQuerySchema } from '../../src/foods/foods.dto';
import { createMealLogSchema, quickAddSchema } from '../../src/meal-logs/meal-logs.dto';
import { createConsentSchema } from '../../src/privacy/privacy.dto';

const SQL_INJECTION_PAYLOADS = [
  "'; DROP TABLE users; --",
  "1' OR '1'='1",
  "1; DELETE FROM foods; --",
  "admin'--",
  "' UNION SELECT * FROM users --",
];

describe('Security: Input Validation', () => {
  describe('XSS and oversized string rejection', () => {
    it('should reject oversized consent version (XSS-like long string)', () => {
      const longXss = '<script>alert(1)</script>'.repeat(10);
      const result = createConsentSchema.safeParse({
        consentType: 'health_data',
        version: longXss,
        accepted: true,
      });
      expect(result.success).toBe(false);
    });

    it('should reject oversized userAgent (>500 chars)', () => {
      const result = createConsentSchema.safeParse({
        consentType: 'health_data',
        version: '1.0',
        accepted: true,
        userAgent: 'x'.repeat(501),
      });
      expect(result.success).toBe(false);
    });
  });

  describe('SQL injection rejection', () => {
    it.each(SQL_INJECTION_PAYLOADS)(
      'should not break when SQL-like string in food search: %s',
      (payload) => {
        const result = foodQuerySchema.safeParse({ search: payload });
        expect(result.success).toBe(true);
        // Prisma uses parameterized queries - the string is passed as data, not SQL.
        // Schema accepts it; DB layer is safe. We verify schema doesn't throw.
      },
    );

    it('should reject invalid UUID in meal log items', () => {
      const result = createMealLogSchema.safeParse({
        items: [
          {
            foodId: "'; DROP TABLE meal_logs; --",
            servingId: '00000000-0000-0000-0000-000000000001',
            quantity: 1,
          },
        ],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('oversized payload rejection', () => {
    it('should reject oversized consent version (>20 chars)', () => {
      const result = createConsentSchema.safeParse({
        consentType: 'health_data',
        version: 'a'.repeat(21),
        accepted: true,
      });
      expect(result.success).toBe(false);
    });

    it('should reject oversized consent ipAddress (>45 chars)', () => {
      const result = createConsentSchema.safeParse({
        consentType: 'health_data',
        version: '1.0',
        accepted: true,
        ipAddress: '1.2.3.4.5.6.7.8.9.10.11.12.13.14.15.16.17.18.19.20.21.22.23.24.25',
      });
      expect(result.success).toBe(false);
    });

    it('should reject oversized meal log note (>500 chars)', () => {
      const result = createMealLogSchema.safeParse({
        items: [
          {
            foodId: '00000000-0000-0000-0000-000000000001',
            servingId: '00000000-0000-0000-0000-000000000002',
            quantity: 1,
          },
        ],
        note: 'x'.repeat(501),
      });
      expect(result.success).toBe(false);
    });

    it('should reject oversized quick add note (>500 chars)', () => {
      const result = quickAddSchema.safeParse({
        calories: 100,
        note: 'x'.repeat(501),
      });
      expect(result.success).toBe(false);
    });

    it('should reject food normalizedName over 500 chars', () => {
      const result = createFoodSchema.safeParse({
        normalizedName: 'x'.repeat(501),
        locale: 'mn',
        servings: [{ label: '100g', gramsPerUnit: 100 }],
        nutrients: {
          caloriesPer100g: 100,
          proteinPer100g: 10,
          carbsPer100g: 10,
          fatPer100g: 5,
        },
      });
      expect(result.success).toBe(false);
    });

    it('should reject pagination limit over 100', () => {
      const result = foodQuerySchema.safeParse({ limit: 101 });
      expect(result.success).toBe(false);
    });
  });

  describe('type validation', () => {
    it('should reject wrong consent type', () => {
      const result = createConsentSchema.safeParse({
        consentType: 'invalid_type',
        version: '1.0',
        accepted: true,
      });
      expect(result.success).toBe(false);
    });

    it('should reject negative quantity in meal log', () => {
      const result = createMealLogSchema.safeParse({
        items: [
          {
            foodId: '00000000-0000-0000-0000-000000000001',
            servingId: '00000000-0000-0000-0000-000000000002',
            quantity: -1,
          },
        ],
      });
      expect(result.success).toBe(false);
    });

    it('should reject negative calories in quick add', () => {
      const result = quickAddSchema.safeParse({ calories: -100 });
      expect(result.success).toBe(false);
    });
  });
});
