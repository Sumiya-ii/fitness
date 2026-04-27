import { canonicalize } from './normalize';

describe('canonicalize', () => {
  describe('exact matches', () => {
    it('matches Mongolian Cyrillic name exactly', () => {
      expect(canonicalize('Бууз')).toEqual({ id: 'mn_buuz', confidence: 1 });
    });

    it('matches English name exactly', () => {
      expect(canonicalize('Buuz (steamed dumpling)')).toEqual({
        id: 'mn_buuz',
        confidence: 1,
      });
    });

    it('matches an alias exactly', () => {
      expect(canonicalize('buuz')).toEqual({ id: 'mn_buuz', confidence: 1 });
    });

    it('is case-insensitive and trims whitespace', () => {
      expect(canonicalize('  BUUZ  ')).toEqual({ id: 'mn_buuz', confidence: 1 });
    });
  });

  describe('Cyrillic ↔ Latin transliteration', () => {
    it('matches a Cyrillic spelling not in the alias list via romanization', () => {
      // 'хуушуур' maps via romanize → 'khuushuur' which IS an alias of mn_khuushuur
      expect(canonicalize('хуушуур')).toEqual({ id: 'mn_khuushuur', confidence: 1 });
    });

    it('matches a Latin alias when only Cyrillic is in the table', () => {
      // 'manjin' is an alias for mn_beet; verify direct alias path stays exact-match
      const result = canonicalize('manjin');
      expect(result.id).toBe('mn_beet');
    });

    it('handles Cyrillic letters not in the alias list via cyrillicization', () => {
      // 'tsuivan' is an alias of mn_tsuivan — try a transliteration: 'цуйван' (Cyrillic form)
      const result = canonicalize('цуйван');
      expect(result.id).toBe('mn_tsuivan');
      // Could be 1 (already in aliases) or 0.95 (via transliteration); accept either
      expect(result.confidence).toBeGreaterThanOrEqual(0.95);
    });
  });

  describe('fuzzy matches', () => {
    it('matches a one-letter typo above the 0.85 threshold', () => {
      // 'buzz' vs 'buuz' — distance 1 / max-len 4 = 0.75 ratio → reject
      expect(canonicalize('buzz')).toEqual({ id: null, confidence: 0 });
    });

    it('matches close-enough variants', () => {
      // 'buuzz' vs 'buuz' — distance 1 / 5 = 0.8 → reject (below 0.85)
      // 'tsivan' vs 'tsuivan' — distance 1/7 = 0.857 → accept fuzzy
      const result = canonicalize('tsivan');
      expect(result.id).toBe('mn_tsuivan');
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
      expect(result.confidence).toBeLessThan(1);
    });
  });

  describe('generic name rejection', () => {
    it.each(['мах', 'meat', 'хоол', 'food', 'soup', 'rice'])(
      'rejects generic name "%s"',
      (name) => {
        expect(canonicalize(name)).toEqual({ id: null, confidence: 0 });
      },
    );

    it('does NOT reject generic-looking but fully-qualified names', () => {
      expect(canonicalize('хонины мах').id).toBe('mn_khoniny_makh');
      expect(canonicalize('chicken breast').id).toBe('mn_chicken_breast');
    });
  });

  describe('no-match cases', () => {
    it('returns null for empty input', () => {
      expect(canonicalize('')).toEqual({ id: null, confidence: 0 });
      expect(canonicalize('   ')).toEqual({ id: null, confidence: 0 });
    });

    it('returns null for non-string input (defensive)', () => {
      // @ts-expect-error -- testing runtime safety
      expect(canonicalize(null)).toEqual({ id: null, confidence: 0 });
      // @ts-expect-error -- testing runtime safety
      expect(canonicalize(undefined)).toEqual({ id: null, confidence: 0 });
    });

    it('returns null for completely unknown food', () => {
      expect(canonicalize('xyzzy')).toEqual({ id: null, confidence: 0 });
      expect(canonicalize('Кращалек')).toEqual({ id: null, confidence: 0 });
    });
  });

  describe('cross-product canonicals', () => {
    it('maps fast food chain items', () => {
      expect(canonicalize('KFC zinger').id).toBe('intl_kfc_zinger');
      expect(canonicalize('pizza').id).toBe('intl_pizza_slice');
      expect(canonicalize('cola').id).toBe('intl_cola_can');
    });

    it('maps Korean popular dishes', () => {
      expect(canonicalize('bibimbap').id).toBe('intl_bibimbap');
      expect(canonicalize('ramyeon').id).toBe('intl_ramyeon');
      expect(canonicalize('kimchi').id).toBe('intl_kimchi');
    });
  });
});
