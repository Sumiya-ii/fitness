/**
 * Canonical Mongolian (and Mongolia-popular international) food list.
 *
 * Single source of truth used by:
 *   - the STT/photo nutrition prompts (so the LLM knows the foods we recognize)
 *   - the canonicalize() normalizer (maps freeform names to a stable ID)
 *   - the calibration loop (per-(userId, canonicalId) accuracy adjustments)
 *
 * IDs are stable forever. Adding new entries is fine; renaming or deleting
 * existing IDs breaks historical calibrations and meal-log groupings — don't.
 *
 * Aliases must be lowercased and may include both Cyrillic and romanized
 * forms. The normalizer also tries automatic transliteration, so aliases
 * are mostly for known unusual spellings ("buurz" for бууз etc.).
 */

export type FoodCategory =
  | 'meat_dish'
  | 'dairy'
  | 'grain'
  | 'vegetable'
  | 'drink'
  | 'snack'
  | 'fast_food'
  | 'protein'
  | 'soup'
  | 'other';

export type FoodUnit = 'piece' | 'bowl' | 'cup' | 'plate' | 'slice' | 'glass' | 'serving' | 'gram';

export interface CanonicalFood {
  /** Stable namespaced ID, never reused. */
  id: string;
  mnName: string;
  enName: string;
  category: FoodCategory;
  /**
   * Lowercased forms a user might say or type — Cyrillic and Latin.
   * Don't include the canonical mnName/enName here; the normalizer matches
   * those automatically.
   */
  aliases: string[];
  baseUnit: FoodUnit;
  /** Average grams per `baseUnit` (one piece, one bowl, etc.). */
  baseGramsPerUnit: number;
  baseKcalPerUnit: number;
  /**
   * Macros per 100g — used by the calibration loop and any future
   * portion-resize calculations.
   */
  per100g: {
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
    sugar?: number;
    /** mg */
    sodium?: number;
    saturatedFat?: number;
  };
}

export const CANONICAL_FOODS: CanonicalFood[] = [
  // ── Mongolian meat dishes ─────────────────────────────────────
  {
    id: 'mn_buuz',
    mnName: 'Бууз',
    enName: 'Buuz (steamed dumpling)',
    category: 'meat_dish',
    aliases: ['buuz', 'buurz', 'буз', 'bouz', 'mongolian dumpling'],
    baseUnit: 'piece',
    baseGramsPerUnit: 40,
    baseKcalPerUnit: 90,
    per100g: { protein: 17.5, carbs: 15, fat: 10 },
  },
  {
    id: 'mn_khuushuur',
    mnName: 'Хуушуур',
    enName: 'Khuushuur (fried meat pastry)',
    category: 'meat_dish',
    aliases: ['khuushuur', 'huushuur', 'huusur', 'хошуур', 'fried dumpling'],
    baseUnit: 'piece',
    baseGramsPerUnit: 50,
    baseKcalPerUnit: 120,
    per100g: { protein: 12, carbs: 18, fat: 12 },
  },
  {
    id: 'mn_bansh',
    mnName: 'Банш',
    enName: 'Bansh (small boiled dumpling)',
    category: 'meat_dish',
    aliases: ['bansh', 'small dumpling'],
    baseUnit: 'piece',
    baseGramsPerUnit: 15,
    baseKcalPerUnit: 30,
    per100g: { protein: 13.3, carbs: 20, fat: 6.7 },
  },
  {
    id: 'mn_tsuivan',
    mnName: 'Цуйван',
    enName: 'Tsuivan (stir-fried noodles with meat)',
    category: 'meat_dish',
    aliases: ['tsuivan', 'tsuvan', 'цойван', 'mongolian stir fry'],
    baseUnit: 'bowl',
    baseGramsPerUnit: 350,
    baseKcalPerUnit: 550,
    per100g: { protein: 8, carbs: 17, fat: 5.7 },
  },
  {
    id: 'mn_guriltai_shul',
    mnName: 'Гурилтай шөл',
    enName: 'Guriltai shul (noodle soup)',
    category: 'soup',
    aliases: ['guriltai shul', 'guriltai', 'noodle soup', 'гуриа', 'гурилтай'],
    baseUnit: 'bowl',
    baseGramsPerUnit: 400,
    baseKcalPerUnit: 300,
    per100g: { protein: 4.5, carbs: 8.75, fat: 2 },
  },
  {
    id: 'mn_khoniny_shul',
    mnName: 'Хонины шөл',
    enName: 'Khoniny shul (mutton broth soup)',
    category: 'soup',
    aliases: ['khoniny shul', 'mutton soup', 'хонины шөл'],
    baseUnit: 'bowl',
    baseGramsPerUnit: 400,
    baseKcalPerUnit: 200,
    per100g: { protein: 3.75, carbs: 2.5, fat: 2.25 },
  },
  {
    id: 'mn_tavgiin_khool',
    mnName: 'Тавгийн хоол',
    enName: 'Tavgiin khool (plate meal: meat + rice + salad)',
    category: 'meat_dish',
    aliases: ['tavgiin khool', 'plate meal', 'тавгийн хоол', 'tavag'],
    baseUnit: 'plate',
    baseGramsPerUnit: 500,
    baseKcalPerUnit: 650,
    per100g: { protein: 7, carbs: 14, fat: 5 },
  },
  {
    id: 'mn_budaatai_khuurga',
    mnName: 'Будаатай хуурга',
    enName: 'Budaatai khuurga (rice stir-fry with meat)',
    category: 'meat_dish',
    aliases: ['budaatai khuurga', 'huurga', 'rice stir fry'],
    baseUnit: 'plate',
    baseGramsPerUnit: 400,
    baseKcalPerUnit: 500,
    per100g: { protein: 7.5, carbs: 13.75, fat: 3.75 },
  },
  {
    id: 'mn_pilaf',
    mnName: 'Тарантай будаа',
    enName: 'Pilaf / Tarantai budaa',
    category: 'meat_dish',
    aliases: ['pilaf', 'tarantai budaa', 'plov', 'плов'],
    baseUnit: 'bowl',
    baseGramsPerUnit: 350,
    baseKcalPerUnit: 480,
    per100g: { protein: 6.3, carbs: 17.1, fat: 4 },
  },

  // ── Dairy & drinks ────────────────────────────────────────────
  {
    id: 'mn_airag',
    mnName: 'Айраг',
    enName: 'Airag (fermented mare milk)',
    category: 'drink',
    aliases: ['airag', 'kumis', 'кумыс'],
    baseUnit: 'cup',
    baseGramsPerUnit: 200,
    baseKcalPerUnit: 55,
    per100g: { protein: 1, carbs: 2, fat: 1 },
  },
  {
    id: 'mn_tarag',
    mnName: 'Тараг',
    enName: 'Tarag (Mongolian yogurt)',
    category: 'dairy',
    aliases: ['tarag', 'yogurt', 'mongolian yogurt'],
    baseUnit: 'cup',
    baseGramsPerUnit: 200,
    baseKcalPerUnit: 80,
    per100g: { protein: 2.5, carbs: 4.5, fat: 1, sugar: 4 },
  },
  {
    id: 'mn_aaruul',
    mnName: 'Ааруул',
    enName: 'Aaruul (dried curd snack)',
    category: 'snack',
    aliases: ['aaruul', 'арул', 'dried curd'],
    baseUnit: 'piece',
    baseGramsPerUnit: 10,
    baseKcalPerUnit: 40,
    per100g: { protein: 30, carbs: 50, fat: 10 },
  },
  {
    id: 'mn_urum',
    mnName: 'Өрөм',
    enName: 'Urum (clotted cream)',
    category: 'dairy',
    aliases: ['urum', 'өрөм', 'clotted cream'],
    baseUnit: 'serving',
    baseGramsPerUnit: 30,
    baseKcalPerUnit: 150,
    per100g: { protein: 3.3, carbs: 6.7, fat: 50 },
  },
  {
    id: 'mn_byaslag',
    mnName: 'Бяслаг',
    enName: 'Byaslag (Mongolian cheese)',
    category: 'dairy',
    aliases: ['byaslag', 'byaslaag', 'cheese', 'бяслаг'],
    baseUnit: 'slice',
    baseGramsPerUnit: 30,
    baseKcalPerUnit: 80,
    per100g: { protein: 16.7, carbs: 3.3, fat: 20 },
  },
  {
    id: 'mn_suutei_tsai',
    mnName: 'Сүүтэй цай',
    enName: 'Suutei tsai (milk tea with salt)',
    category: 'drink',
    aliases: ['suutei tsai', 'sutei tsai', 'milk tea', 'сүүтэй цай'],
    baseUnit: 'cup',
    baseGramsPerUnit: 200,
    baseKcalPerUnit: 35,
    per100g: { protein: 1, carbs: 1, fat: 1 },
  },
  {
    id: 'mn_tsai_plain',
    mnName: 'Хар цай',
    enName: 'Plain tea',
    category: 'drink',
    aliases: ['tsai', 'tea', 'plain tea', 'хар цай', 'цай'],
    baseUnit: 'cup',
    baseGramsPerUnit: 200,
    baseKcalPerUnit: 2,
    per100g: { protein: 0, carbs: 0.5, fat: 0 },
  },
  {
    id: 'mn_suu',
    mnName: 'Сүү',
    enName: 'Whole milk',
    category: 'dairy',
    aliases: ['suu', 'milk', 'сүү', 'whole milk'],
    baseUnit: 'glass',
    baseGramsPerUnit: 250,
    baseKcalPerUnit: 150,
    per100g: { protein: 3.2, carbs: 4.8, fat: 3.2, sugar: 4.8 },
  },

  // ── Breads & snacks ───────────────────────────────────────────
  {
    id: 'mn_talkh',
    mnName: 'Талх',
    enName: 'Talkh (bread slice)',
    category: 'grain',
    aliases: ['talkh', 'bread', 'талх'],
    baseUnit: 'slice',
    baseGramsPerUnit: 30,
    baseKcalPerUnit: 70,
    per100g: { protein: 6.7, carbs: 43.3, fat: 3.3 },
  },
  {
    id: 'mn_boov',
    mnName: 'Боов',
    enName: 'Boov (fried dough cookie)',
    category: 'snack',
    aliases: ['boov', 'fried cookie', 'боов'],
    baseUnit: 'piece',
    baseGramsPerUnit: 35,
    baseKcalPerUnit: 80,
    per100g: { protein: 2.9, carbs: 28.6, fat: 11.4 },
  },
  {
    id: 'mn_ul_boov',
    mnName: 'Ул боов',
    enName: 'Ul boov (layered cookie)',
    category: 'snack',
    aliases: ['ul boov', 'ulboov', 'layered cookie'],
    baseUnit: 'piece',
    baseGramsPerUnit: 50,
    baseKcalPerUnit: 120,
    per100g: { protein: 4, carbs: 32, fat: 12 },
  },

  // ── Common proteins & produce ─────────────────────────────────
  {
    id: 'mn_khoniny_makh',
    mnName: 'Хонины мах',
    enName: 'Mutton (khoniny makh)',
    category: 'protein',
    aliases: ['khoniny makh', 'mutton', 'lamb', 'хонины мах', 'хонь', 'хонины'],
    baseUnit: 'gram',
    baseGramsPerUnit: 100,
    baseKcalPerUnit: 260,
    per100g: { protein: 17, carbs: 0, fat: 21, saturatedFat: 9 },
  },
  {
    id: 'mn_ukhriin_makh',
    mnName: 'Үхрийн мах',
    enName: 'Beef (ukhriin makh)',
    category: 'protein',
    aliases: ['ukhriin makh', 'beef', 'үхрийн мах', 'үхэр', 'үхрийн'],
    baseUnit: 'gram',
    baseGramsPerUnit: 100,
    baseKcalPerUnit: 250,
    per100g: { protein: 26, carbs: 0, fat: 16, saturatedFat: 6 },
  },
  {
    id: 'mn_chicken_breast',
    mnName: 'Тахианы цээж',
    enName: 'Chicken breast',
    category: 'protein',
    aliases: ['takhiany makh breast', 'chicken breast', 'chicken', 'тахианы цээж', 'тахиа'],
    baseUnit: 'gram',
    baseGramsPerUnit: 100,
    baseKcalPerUnit: 165,
    per100g: { protein: 31, carbs: 0, fat: 4 },
  },
  {
    id: 'mn_chicken_thigh',
    mnName: 'Тахианы гуя',
    enName: 'Chicken thigh',
    category: 'protein',
    aliases: ['takhiany makh thigh', 'chicken thigh', 'тахианы гуя'],
    baseUnit: 'gram',
    baseGramsPerUnit: 100,
    baseKcalPerUnit: 210,
    per100g: { protein: 26, carbs: 0, fat: 11 },
  },
  {
    id: 'mn_fish',
    mnName: 'Загас',
    enName: 'Fish',
    category: 'protein',
    aliases: ['zaghas', 'zagas', 'fish', 'загас'],
    baseUnit: 'gram',
    baseGramsPerUnit: 100,
    baseKcalPerUnit: 150,
    per100g: { protein: 22, carbs: 0, fat: 7 },
  },
  {
    id: 'mn_egg',
    mnName: 'Өндөг',
    enName: 'Egg',
    category: 'protein',
    aliases: ['undug', 'undeg', 'egg', 'өндөг', 'undog'],
    baseUnit: 'piece',
    baseGramsPerUnit: 50,
    baseKcalPerUnit: 70,
    per100g: { protein: 12, carbs: 1, fat: 10 },
  },
  {
    id: 'mn_white_rice_cooked',
    mnName: 'Цагаан будаа',
    enName: 'White rice (cooked)',
    category: 'grain',
    aliases: ['tsagaan budaa', 'white rice', 'rice', 'цагаан будаа'],
    baseUnit: 'cup',
    baseGramsPerUnit: 160,
    baseKcalPerUnit: 200,
    per100g: { protein: 2.5, carbs: 28, fat: 0 },
  },
  {
    id: 'mn_brown_rice_cooked',
    mnName: 'Хар будаа',
    enName: 'Brown rice (cooked)',
    category: 'grain',
    aliases: ['khar budaa', 'brown rice', 'хар будаа'],
    baseUnit: 'cup',
    baseGramsPerUnit: 160,
    baseKcalPerUnit: 215,
    per100g: { protein: 3.1, carbs: 28, fat: 1.25 },
  },
  {
    id: 'mn_potato',
    mnName: 'Төмс',
    enName: 'Potato',
    category: 'vegetable',
    aliases: ['tums', 'tumus', 'potato', 'төмс'],
    baseUnit: 'gram',
    baseGramsPerUnit: 100,
    baseKcalPerUnit: 77,
    per100g: { protein: 2, carbs: 17, fat: 0 },
  },
  {
    id: 'mn_cabbage',
    mnName: 'Байцаа',
    enName: 'Cabbage',
    category: 'vegetable',
    aliases: ['baitsaa', 'cabbage', 'байцаа'],
    baseUnit: 'gram',
    baseGramsPerUnit: 100,
    baseKcalPerUnit: 25,
    per100g: { protein: 1, carbs: 6, fat: 0 },
  },
  {
    id: 'mn_carrot',
    mnName: 'Лууван',
    enName: 'Carrot',
    category: 'vegetable',
    aliases: ['luuvan', 'carrot', 'лууван'],
    baseUnit: 'gram',
    baseGramsPerUnit: 100,
    baseKcalPerUnit: 41,
    per100g: { protein: 1, carbs: 10, fat: 0, sugar: 4.7 },
  },
  {
    id: 'mn_beet',
    mnName: 'Манжин',
    enName: 'Beet',
    category: 'vegetable',
    aliases: ['manjin', 'beet', 'манжин'],
    baseUnit: 'gram',
    baseGramsPerUnit: 100,
    baseKcalPerUnit: 43,
    per100g: { protein: 2, carbs: 10, fat: 0 },
  },
  {
    id: 'mn_onion',
    mnName: 'Сонгино',
    enName: 'Onion',
    category: 'vegetable',
    aliases: ['songino', 'onion', 'сонгино'],
    baseUnit: 'gram',
    baseGramsPerUnit: 100,
    baseKcalPerUnit: 40,
    per100g: { protein: 1, carbs: 9, fat: 0 },
  },
  {
    id: 'mn_cucumber',
    mnName: 'Өргөст хэмх',
    enName: 'Cucumber',
    category: 'vegetable',
    aliases: ['urgust khemekh', 'cucumber', 'өргөст хэмх', 'өргөст'],
    baseUnit: 'gram',
    baseGramsPerUnit: 100,
    baseKcalPerUnit: 16,
    per100g: { protein: 1, carbs: 4, fat: 0 },
  },
  {
    id: 'mn_tomato',
    mnName: 'Улаан лооль',
    enName: 'Tomato',
    category: 'vegetable',
    aliases: ['ulaan lool', 'ulaan lool', 'tomato', 'улаан лооль'],
    baseUnit: 'gram',
    baseGramsPerUnit: 100,
    baseKcalPerUnit: 18,
    per100g: { protein: 1, carbs: 4, fat: 0 },
  },
  {
    id: 'mn_sausage',
    mnName: 'Хиам',
    enName: 'Sausage / khiam',
    category: 'protein',
    aliases: ['khiam', 'sausage', 'хиам'],
    baseUnit: 'gram',
    baseGramsPerUnit: 100,
    baseKcalPerUnit: 290,
    per100g: { protein: 11, carbs: 2, fat: 27, saturatedFat: 10 },
  },

  // ── Fast food (Mongolia-popular) ──────────────────────────────
  {
    id: 'intl_kfc_original',
    mnName: 'KFC оригинал',
    enName: 'KFC original piece',
    category: 'fast_food',
    aliases: ['kfc original', 'kfc piece', 'kfc'],
    baseUnit: 'piece',
    baseGramsPerUnit: 110,
    baseKcalPerUnit: 320,
    per100g: { protein: 23.6, carbs: 10, fat: 18.2 },
  },
  {
    id: 'intl_kfc_zinger',
    mnName: 'KFC Зингэр',
    enName: 'KFC Zinger burger',
    category: 'fast_food',
    aliases: ['kfc zinger', 'zinger burger'],
    baseUnit: 'piece',
    baseGramsPerUnit: 220,
    baseKcalPerUnit: 560,
    per100g: { protein: 13.6, carbs: 22.7, fat: 10.9 },
  },
  {
    id: 'intl_pizza_slice',
    mnName: 'Пицца зүсэм',
    enName: 'Pizza slice (cheese)',
    category: 'fast_food',
    aliases: ['pizza', 'pizza slice', 'пицца'],
    baseUnit: 'slice',
    baseGramsPerUnit: 100,
    baseKcalPerUnit: 280,
    per100g: { protein: 12, carbs: 36, fat: 10 },
  },
  {
    id: 'intl_hamburger',
    mnName: 'Хамбургер',
    enName: 'Hamburger (standard)',
    category: 'fast_food',
    aliases: ['hamburger', 'burger', 'хамбургер'],
    baseUnit: 'piece',
    baseGramsPerUnit: 220,
    baseKcalPerUnit: 500,
    per100g: { protein: 11.4, carbs: 20.5, fat: 10 },
  },
  {
    id: 'intl_french_fries',
    mnName: 'Шарсан төмс',
    enName: 'French fries (medium)',
    category: 'fast_food',
    aliases: ['french fries', 'fries', 'шарсан төмс'],
    baseUnit: 'serving',
    baseGramsPerUnit: 120,
    baseKcalPerUnit: 380,
    per100g: { protein: 4.2, carbs: 41.7, fat: 14.2 },
  },
  {
    id: 'intl_subway_6inch',
    mnName: 'Subway 6 инч',
    enName: 'Subway 6-inch sandwich',
    category: 'fast_food',
    aliases: ['subway', 'subway sandwich', 'subway 6 inch'],
    baseUnit: 'piece',
    baseGramsPerUnit: 220,
    baseKcalPerUnit: 380,
    per100g: { protein: 9.1, carbs: 20.9, fat: 4.5 },
  },
  {
    id: 'intl_cola_can',
    mnName: 'Кола',
    enName: 'Cola / soda 330ml can',
    category: 'drink',
    aliases: ['cola', 'coke', 'soda', 'pepsi', 'кола'],
    baseUnit: 'glass',
    baseGramsPerUnit: 330,
    baseKcalPerUnit: 140,
    per100g: { protein: 0, carbs: 10.6, fat: 0, sugar: 10.6 },
  },

  // ── Korean (popular in UB) ────────────────────────────────────
  {
    id: 'intl_bibimbap',
    mnName: 'Бибимбап',
    enName: 'Bibimbap',
    category: 'meat_dish',
    aliases: ['bibimbap', 'бибимбап'],
    baseUnit: 'bowl',
    baseGramsPerUnit: 450,
    baseKcalPerUnit: 550,
    per100g: { protein: 4.4, carbs: 18.9, fat: 2.7 },
  },
  {
    id: 'intl_samgyeopsal',
    mnName: 'Самгёпсал',
    enName: 'Samgyeopsal (pork belly, 150g)',
    category: 'protein',
    aliases: ['samgyeopsal', 'pork belly', 'самгёпсал'],
    baseUnit: 'serving',
    baseGramsPerUnit: 150,
    baseKcalPerUnit: 450,
    per100g: { protein: 18, carbs: 0, fat: 25.3 },
  },
  {
    id: 'intl_ramyeon',
    mnName: 'Рамён',
    enName: 'Ramyeon (1 pack)',
    category: 'meat_dish',
    aliases: ['ramyeon', 'ramen', 'рамён'],
    baseUnit: 'bowl',
    baseGramsPerUnit: 500,
    baseKcalPerUnit: 450,
    per100g: { protein: 2, carbs: 12, fat: 3.6, sodium: 320 },
  },
  {
    id: 'intl_kimchi',
    mnName: 'Кимчи',
    enName: 'Kimchi',
    category: 'vegetable',
    aliases: ['kimchi', 'кимчи'],
    baseUnit: 'gram',
    baseGramsPerUnit: 100,
    baseKcalPerUnit: 20,
    per100g: { protein: 1, carbs: 4, fat: 0, sodium: 670 },
  },
  {
    id: 'intl_bulgogi',
    mnName: 'Булгоги',
    enName: 'Bulgogi (150g)',
    category: 'protein',
    aliases: ['bulgogi', 'булгоги'],
    baseUnit: 'serving',
    baseGramsPerUnit: 150,
    baseKcalPerUnit: 375,
    per100g: { protein: 20, carbs: 10, fat: 14 },
  },
  {
    id: 'intl_tteokbokki',
    mnName: 'Тыокбокки',
    enName: 'Tteokbokki',
    category: 'snack',
    aliases: ['tteokbokki', 'tokbokki'],
    baseUnit: 'serving',
    baseGramsPerUnit: 250,
    baseKcalPerUnit: 280,
    per100g: { protein: 2.4, carbs: 22, fat: 1.6 },
  },
  {
    id: 'intl_sundubu_jjigae',
    mnName: 'Сундубу жижиг',
    enName: 'Sundubu jjigae (soft tofu stew)',
    category: 'soup',
    aliases: ['sundubu jjigae', 'soft tofu stew', 'sundubu'],
    baseUnit: 'bowl',
    baseGramsPerUnit: 400,
    baseKcalPerUnit: 300,
    per100g: { protein: 5, carbs: 3, fat: 4.5 },
  },
  {
    id: 'intl_japchae',
    mnName: 'Жапчае',
    enName: 'Japchae',
    category: 'meat_dish',
    aliases: ['japchae', 'жапчае'],
    baseUnit: 'serving',
    baseGramsPerUnit: 250,
    baseKcalPerUnit: 400,
    per100g: { protein: 3.2, carbs: 22, fat: 5.6 },
  },
];

/**
 * Pre-built lookup map: lowercased name/alias → canonical id.
 * Built once at module load. ~500 entries; constant-time lookup.
 */
export const CANONICAL_BY_NAME: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const food of CANONICAL_FOODS) {
    const keys = [food.mnName, food.enName, ...food.aliases];
    for (const key of keys) {
      const k = key.trim().toLowerCase();
      if (k && !map.has(k)) map.set(k, food.id);
    }
  }
  return map;
})();

export const CANONICAL_BY_ID: ReadonlyMap<string, CanonicalFood> = new Map(
  CANONICAL_FOODS.map((f) => [f.id, f]),
);
