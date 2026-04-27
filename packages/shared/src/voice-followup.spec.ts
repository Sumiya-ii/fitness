import { shouldAskFollowUp, type VoiceParsedItem } from './voice-followup';

const baseItem = (overrides: Partial<VoiceParsedItem> = {}): VoiceParsedItem => ({
  name: 'Бууз',
  quantity: 4,
  unit: 'piece',
  grams: 200,
  calories: 360,
  protein: 28,
  carbs: 24,
  fat: 16,
  confidence: 0.9,
  ...overrides,
});

describe('shouldAskFollowUp', () => {
  it('returns null when transcription is empty', () => {
    expect(shouldAskFollowUp([baseItem()], '   ')).toBeNull();
  });

  it('triggers no_items_but_speech when transcription has speech but no items', () => {
    const trigger = shouldAskFollowUp([], 'Би өнөөдөр юм идлээ');
    expect(trigger).toEqual({ reason: 'no_items_but_speech', itemIndex: null });
  });

  it('returns null on a clean single item with high confidence', () => {
    expect(shouldAskFollowUp([baseItem()], 'Би 4 бууз идлээ')).toBeNull();
  });

  it('triggers missing_quantity on high-kcal item with quantity missing', () => {
    const trigger = shouldAskFollowUp(
      [baseItem({ missing: ['quantity'], quantity: 1 })],
      'Би бууз идлээ',
    );
    expect(trigger).toEqual({ reason: 'missing_quantity', itemIndex: 0 });
  });

  it('triggers meat_type_ambiguous when ambiguity flag is meat_type', () => {
    const trigger = shouldAskFollowUp(
      [baseItem({ name: 'Хуушуур', ambiguity: 'meat_type' })],
      'Хуушуур идлээ',
    );
    expect(trigger).toEqual({ reason: 'meat_type_ambiguous', itemIndex: 0 });
  });

  it('triggers low_confidence_high_kcal when confidence < 0.65 on dominant item', () => {
    const trigger = shouldAskFollowUp([baseItem({ confidence: 0.5 })], 'something idlee');
    expect(trigger).toEqual({ reason: 'low_confidence_high_kcal', itemIndex: 0 });
  });

  it('does not ask about a low-kcal side item even with low confidence', () => {
    const trigger = shouldAskFollowUp(
      [
        baseItem({ name: 'Цуйван', calories: 550 }),
        baseItem({ name: 'кетчуп', calories: 20, confidence: 0.4 }),
      ],
      'цуйван идлээ',
    );
    expect(trigger).toBeNull();
  });

  it('triggers unrealistic_portion when kcal/g > 9', () => {
    const trigger = shouldAskFollowUp(
      [baseItem({ name: 'Тос', grams: 5, calories: 100 })],
      'тос хэрэглэлээ',
    );
    expect(trigger).toEqual({ reason: 'unrealistic_portion', itemIndex: 0 });
  });

  it('escalates borderline confidence (0.65-0.75) to low_conf when transcription contains hedge words', () => {
    const trigger = shouldAskFollowUp(
      [baseItem({ confidence: 0.7 })],
      'Магадгүй 4 бууз шиг юм идсэн',
    );
    expect(trigger).toEqual({ reason: 'low_confidence_high_kcal', itemIndex: 0 });
  });

  it('does NOT escalate confidence ≥ 0.75 even with hedge words', () => {
    const trigger = shouldAskFollowUp([baseItem({ confidence: 0.85 })], 'Магадгүй 4 бууз идсэн');
    expect(trigger).toBeNull();
  });

  it('flags generic food name "мах" as ambiguous preparation', () => {
    const trigger = shouldAskFollowUp([baseItem({ name: 'мах', confidence: 0.8 })], 'Мах идлээ');
    expect(trigger).toEqual({ reason: 'preparation_ambiguous', itemIndex: 0 });
  });

  it('prefers ambiguity over low_confidence when both present (ambiguity is more actionable)', () => {
    const trigger = shouldAskFollowUp(
      [baseItem({ ambiguity: 'meat_type', confidence: 0.4 })],
      'хуушуур идлээ',
    );
    expect(trigger).toEqual({ reason: 'meat_type_ambiguous', itemIndex: 0 });
  });

  it('picks highest-kcal item among multiple ambiguous high-kcal items', () => {
    const trigger = shouldAskFollowUp(
      [
        baseItem({ name: 'A', calories: 200, ambiguity: 'meat_type' }),
        baseItem({ name: 'B', calories: 600, ambiguity: 'meat_type' }),
      ],
      'A and B idlee',
    );
    expect(trigger).toEqual({ reason: 'meat_type_ambiguous', itemIndex: 1 });
  });

  it('picks lowest-confidence item among multiple low-confidence items', () => {
    const trigger = shouldAskFollowUp(
      [
        baseItem({ name: 'A', confidence: 0.6, calories: 400 }),
        baseItem({ name: 'B', confidence: 0.3, calories: 400 }),
      ],
      'something idlee',
    );
    expect(trigger).toEqual({ reason: 'low_confidence_high_kcal', itemIndex: 1 });
  });

  it('respects English hedges as well as Mongolian', () => {
    const trigger = shouldAskFollowUp([baseItem({ confidence: 0.7 })], 'I had maybe 4 buuz');
    expect(trigger).toEqual({ reason: 'low_confidence_high_kcal', itemIndex: 0 });
  });
});
