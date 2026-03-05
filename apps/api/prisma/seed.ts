import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface SeedFood {
  name: string;
  nameMn: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  servings: Array<{ label: string; labelMn: string; grams: number; isDefault?: boolean }>;
}

const FOODS: SeedFood[] = [
  // === Traditional Mongolian Dishes ===
  { name: 'Buuz (steamed dumpling)', nameMn: 'Бууз', calories: 220, protein: 12, carbs: 18, fat: 11, servings: [{ label: '1 piece', labelMn: '1 ширхэг', grams: 60, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Khuushuur (fried dumpling)', nameMn: 'Хуушуур', calories: 280, protein: 11, carbs: 22, fat: 17, servings: [{ label: '1 piece', labelMn: '1 ширхэг', grams: 80, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Tsuivan (stir-fried noodles)', nameMn: 'Цуйван', calories: 180, protein: 10, carbs: 20, fat: 7, servings: [{ label: '1 serving', labelMn: '1 порц', grams: 300, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Banshtai shol (dumpling soup)', nameMn: 'Банштай шөл', calories: 90, protein: 6, carbs: 10, fat: 3, servings: [{ label: '1 bowl', labelMn: '1 аяга', grams: 400, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Guriltai shol (noodle soup)', nameMn: 'Гурилтай шөл', calories: 85, protein: 5, carbs: 11, fat: 2, servings: [{ label: '1 bowl', labelMn: '1 аяга', grams: 400, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Khorkhog (BBQ mutton)', nameMn: 'Хорхог', calories: 250, protein: 18, carbs: 2, fat: 19, servings: [{ label: '1 serving', labelMn: '1 порц', grams: 250, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Boodog (roasted goat)', nameMn: 'Боодог', calories: 240, protein: 20, carbs: 0, fat: 18, servings: [{ label: '1 serving', labelMn: '1 порц', grams: 200, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Borts (dried meat)', nameMn: 'Борц', calories: 350, protein: 55, carbs: 0, fat: 14, servings: [{ label: '1 handful', labelMn: '1 атга', grams: 30, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Gambir (flat bread)', nameMn: 'Гамбир', calories: 320, protein: 8, carbs: 52, fat: 9, servings: [{ label: '1 piece', labelMn: '1 ширхэг', grams: 120, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Niislel salat (capital salad)', nameMn: 'Нийслэл салат', calories: 180, protein: 5, carbs: 12, fat: 13, servings: [{ label: '1 serving', labelMn: '1 порц', grams: 200, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },

  // === Mongolian Dairy Products ===
  { name: 'Airag (fermented mare milk)', nameMn: 'Айраг', calories: 48, protein: 2, carbs: 6, fat: 1.5, servings: [{ label: '1 cup', labelMn: '1 аяга', grams: 250, isDefault: true }, { label: '100ml', labelMn: '100мл', grams: 100 }] },
  { name: 'Tarag (yogurt)', nameMn: 'Тараг', calories: 60, protein: 3.5, carbs: 4.5, fat: 3, servings: [{ label: '1 cup', labelMn: '1 аяга', grams: 200, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Aaruul (dried curd)', nameMn: 'Аарул', calories: 380, protein: 12, carbs: 50, fat: 15, servings: [{ label: '1 piece', labelMn: '1 ширхэг', grams: 20, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Tsagaan idee (white food - cream)', nameMn: 'Цагаан идээ', calories: 350, protein: 3, carbs: 4, fat: 37, servings: [{ label: '1 tbsp', labelMn: '1 халбага', grams: 15, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Suutei tsai (milk tea)', nameMn: 'Сүүтэй цай', calories: 45, protein: 2, carbs: 4, fat: 2, servings: [{ label: '1 cup', labelMn: '1 аяга', grams: 250, isDefault: true }, { label: '100ml', labelMn: '100мл', grams: 100 }] },
  { name: 'Byaslag (cheese)', nameMn: 'Бяслаг', calories: 310, protein: 22, carbs: 2, fat: 24, servings: [{ label: '1 slice', labelMn: '1 зүсэм', grams: 30, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Urum (clotted cream)', nameMn: 'Өрөм', calories: 400, protein: 3, carbs: 3, fat: 42, servings: [{ label: '1 tbsp', labelMn: '1 халбага', grams: 20, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },

  // === Common Proteins ===
  { name: 'Mutton (lamb)', nameMn: 'Хонины мах', calories: 250, protein: 17, carbs: 0, fat: 20, servings: [{ label: '1 serving', labelMn: '1 порц', grams: 150, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Beef', nameMn: 'Үхрийн мах', calories: 250, protein: 26, carbs: 0, fat: 16, servings: [{ label: '1 serving', labelMn: '1 порц', grams: 150, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Goat meat', nameMn: 'Ямааны мах', calories: 143, protein: 27, carbs: 0, fat: 3, servings: [{ label: '1 serving', labelMn: '1 порц', grams: 150, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Horse meat', nameMn: 'Адууны мах', calories: 175, protein: 28, carbs: 0, fat: 6, servings: [{ label: '1 serving', labelMn: '1 порц', grams: 150, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Chicken breast', nameMn: 'Тахианы цээж', calories: 165, protein: 31, carbs: 0, fat: 3.6, servings: [{ label: '1 breast', labelMn: '1 цээж', grams: 170, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Chicken thigh', nameMn: 'Тахианы гуя', calories: 209, protein: 26, carbs: 0, fat: 11, servings: [{ label: '1 thigh', labelMn: '1 гуя', grams: 130, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Pork', nameMn: 'Гахайн мах', calories: 242, protein: 27, carbs: 0, fat: 14, servings: [{ label: '1 serving', labelMn: '1 порц', grams: 150, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Egg (whole)', nameMn: 'Өндөг', calories: 155, protein: 13, carbs: 1.1, fat: 11, servings: [{ label: '1 egg', labelMn: '1 өндөг', grams: 50, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Fish (river)', nameMn: 'Загас', calories: 105, protein: 22, carbs: 0, fat: 2, servings: [{ label: '1 fillet', labelMn: '1 зүсэм', grams: 150, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },

  // === Grains & Starches ===
  { name: 'White rice (cooked)', nameMn: 'Будаа (чанасан)', calories: 130, protein: 2.7, carbs: 28, fat: 0.3, servings: [{ label: '1 cup', labelMn: '1 аяга', grams: 200, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Wheat flour', nameMn: 'Гурилан будаа', calories: 364, protein: 10, carbs: 76, fat: 1, servings: [{ label: '1 cup', labelMn: '1 аяга', grams: 125, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Bread (white)', nameMn: 'Цагаан талх', calories: 265, protein: 9, carbs: 49, fat: 3.2, servings: [{ label: '1 slice', labelMn: '1 зүсэм', grams: 30, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Bread (brown)', nameMn: 'Хүрэн талх', calories: 250, protein: 10, carbs: 44, fat: 3.5, servings: [{ label: '1 slice', labelMn: '1 зүсэм', grams: 30, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Noodles (wheat)', nameMn: 'Гурил (гоймон)', calories: 138, protein: 5, carbs: 25, fat: 2, servings: [{ label: '1 serving', labelMn: '1 порц', grams: 200, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Potato', nameMn: 'Төмс', calories: 77, protein: 2, carbs: 17, fat: 0.1, servings: [{ label: '1 medium', labelMn: '1 дунд', grams: 150, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Oatmeal (cooked)', nameMn: 'Овъёос (чанасан)', calories: 68, protein: 2.5, carbs: 12, fat: 1.4, servings: [{ label: '1 bowl', labelMn: '1 аяга', grams: 250, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Buckwheat (cooked)', nameMn: 'Гречка (чанасан)', calories: 92, protein: 3.4, carbs: 20, fat: 0.6, servings: [{ label: '1 cup', labelMn: '1 аяга', grams: 200, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Millet porridge', nameMn: 'Шар будаа', calories: 119, protein: 3.5, carbs: 23, fat: 1, servings: [{ label: '1 bowl', labelMn: '1 аяга', grams: 250, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },

  // === Vegetables ===
  { name: 'Carrot', nameMn: 'Лууван', calories: 41, protein: 0.9, carbs: 10, fat: 0.2, fiber: 2.8, servings: [{ label: '1 medium', labelMn: '1 дунд', grams: 80, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Cabbage', nameMn: 'Байцаа', calories: 25, protein: 1.3, carbs: 6, fat: 0.1, fiber: 2.5, servings: [{ label: '1 cup shredded', labelMn: '1 аяга', grams: 90, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Onion', nameMn: 'Сонгино', calories: 40, protein: 1.1, carbs: 9, fat: 0.1, servings: [{ label: '1 medium', labelMn: '1 дунд', grams: 110, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Garlic', nameMn: 'Сармис', calories: 149, protein: 6.4, carbs: 33, fat: 0.5, servings: [{ label: '1 clove', labelMn: '1 хэсэг', grams: 3, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Tomato', nameMn: 'Улаан лооль', calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2, servings: [{ label: '1 medium', labelMn: '1 дунд', grams: 120, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Cucumber', nameMn: 'Өргөст хэмх', calories: 15, protein: 0.7, carbs: 3.6, fat: 0.1, servings: [{ label: '1 medium', labelMn: '1 дунд', grams: 150, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Bell pepper', nameMn: 'Чинжүү', calories: 31, protein: 1, carbs: 6, fat: 0.3, servings: [{ label: '1 medium', labelMn: '1 дунд', grams: 120, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Beet', nameMn: 'Маньж', calories: 43, protein: 1.6, carbs: 10, fat: 0.2, servings: [{ label: '1 medium', labelMn: '1 дунд', grams: 100, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Turnip', nameMn: 'Гонид', calories: 28, protein: 0.9, carbs: 6, fat: 0.1, servings: [{ label: '1 medium', labelMn: '1 дунд', grams: 120, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },

  // === Fruits ===
  { name: 'Apple', nameMn: 'Алим', calories: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4, servings: [{ label: '1 medium', labelMn: '1 дунд', grams: 180, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Banana', nameMn: 'Гадил', calories: 89, protein: 1.1, carbs: 23, fat: 0.3, servings: [{ label: '1 medium', labelMn: '1 дунд', grams: 120, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Orange', nameMn: 'Жүрж', calories: 47, protein: 0.9, carbs: 12, fat: 0.1, servings: [{ label: '1 medium', labelMn: '1 дунд', grams: 150, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Watermelon', nameMn: 'Тарвас', calories: 30, protein: 0.6, carbs: 8, fat: 0.2, servings: [{ label: '1 slice', labelMn: '1 зүсэм', grams: 300, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Grapes', nameMn: 'Усан үзэм', calories: 69, protein: 0.7, carbs: 18, fat: 0.2, servings: [{ label: '1 cup', labelMn: '1 аяга', grams: 150, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Tangerine', nameMn: 'Жижиг жүрж', calories: 53, protein: 0.8, carbs: 13, fat: 0.3, servings: [{ label: '1 medium', labelMn: '1 дунд', grams: 80, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Dried fruit mix', nameMn: 'Хатаасан жимс', calories: 280, protein: 3, carbs: 68, fat: 0.5, servings: [{ label: '1 handful', labelMn: '1 атга', grams: 40, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },

  // === Dairy & Drinks ===
  { name: 'Whole milk', nameMn: 'Бүтэн тослог сүү', calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3, servings: [{ label: '1 cup', labelMn: '1 аяга', grams: 250, isDefault: true }, { label: '100ml', labelMn: '100мл', grams: 100 }] },
  { name: 'Kefir', nameMn: 'Кефир', calories: 41, protein: 3.4, carbs: 4.7, fat: 1, servings: [{ label: '1 cup', labelMn: '1 аяга', grams: 250, isDefault: true }, { label: '100ml', labelMn: '100мл', grams: 100 }] },
  { name: 'Sour cream', nameMn: 'Зөөхий', calories: 193, protein: 2.1, carbs: 3.4, fat: 19.5, servings: [{ label: '1 tbsp', labelMn: '1 халбага', grams: 20, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Butter', nameMn: 'Масло', calories: 717, protein: 0.9, carbs: 0.1, fat: 81, servings: [{ label: '1 tbsp', labelMn: '1 халбага', grams: 14, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Cottage cheese', nameMn: 'Ааруул', calories: 98, protein: 11, carbs: 3.4, fat: 4.3, servings: [{ label: '1/2 cup', labelMn: '1/2 аяга', grams: 110, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },

  // === Common Korean/Chinese/Russian influenced dishes ===
  { name: 'Kimchi', nameMn: 'Кимчи', calories: 15, protein: 1.1, carbs: 2.4, fat: 0.5, servings: [{ label: '1 serving', labelMn: '1 порц', grams: 50, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Pelmeni (dumplings)', nameMn: 'Бантан', calories: 210, protein: 10, carbs: 25, fat: 8, servings: [{ label: '10 pieces', labelMn: '10 ширхэг', grams: 200, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Borscht', nameMn: 'Борщ', calories: 50, protein: 2, carbs: 7, fat: 2, servings: [{ label: '1 bowl', labelMn: '1 аяга', grams: 350, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Fried rice', nameMn: 'Шарсан будаа', calories: 163, protein: 3.5, carbs: 24, fat: 6, servings: [{ label: '1 plate', labelMn: '1 тавиур', grams: 300, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Ramen', nameMn: 'Рамен', calories: 120, protein: 5, carbs: 18, fat: 3, servings: [{ label: '1 bowl', labelMn: '1 аяга', grams: 500, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },

  // === Snacks & Processed ===
  { name: 'Boov (Mongolian cookie)', nameMn: 'Боов', calories: 420, protein: 7, carbs: 60, fat: 17, servings: [{ label: '1 piece', labelMn: '1 ширхэг', grams: 50, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Boortsog (fried dough)', nameMn: 'Боорцог', calories: 400, protein: 7, carbs: 50, fat: 19, servings: [{ label: '1 piece', labelMn: '1 ширхэг', grams: 25, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Chocolate bar', nameMn: 'Шоколад', calories: 535, protein: 5, carbs: 60, fat: 30, servings: [{ label: '1 bar', labelMn: '1 ширхэг', grams: 45, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Instant noodles', nameMn: 'Доширак', calories: 450, protein: 9, carbs: 62, fat: 18, servings: [{ label: '1 pack', labelMn: '1 баглаа', grams: 100, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Sausage (cooked)', nameMn: 'Зайдас', calories: 301, protein: 12, carbs: 2, fat: 28, servings: [{ label: '1 piece', labelMn: '1 ширхэг', grams: 100, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },

  // === Oils & Condiments ===
  { name: 'Vegetable oil', nameMn: 'Ургамлын тос', calories: 884, protein: 0, carbs: 0, fat: 100, servings: [{ label: '1 tbsp', labelMn: '1 халбага', grams: 14, isDefault: true }, { label: '100ml', labelMn: '100мл', grams: 100 }] },
  { name: 'Salt', nameMn: 'Давс', calories: 0, protein: 0, carbs: 0, fat: 0, servings: [{ label: '1 tsp', labelMn: '1 цайны халбага', grams: 6, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Sugar', nameMn: 'Чихэр', calories: 387, protein: 0, carbs: 100, fat: 0, servings: [{ label: '1 tsp', labelMn: '1 цайны халбага', grams: 4, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Honey', nameMn: 'Зөгийн бал', calories: 304, protein: 0.3, carbs: 82, fat: 0, servings: [{ label: '1 tbsp', labelMn: '1 халбага', grams: 21, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Soy sauce', nameMn: 'Шар буурцаг', calories: 53, protein: 8, carbs: 5, fat: 0.6, servings: [{ label: '1 tbsp', labelMn: '1 халбага', grams: 18, isDefault: true }, { label: '100ml', labelMn: '100мл', grams: 100 }] },
  { name: 'Ketchup', nameMn: 'Кетчуп', calories: 112, protein: 1.7, carbs: 26, fat: 0.1, servings: [{ label: '1 tbsp', labelMn: '1 халбага', grams: 17, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Mayonnaise', nameMn: 'Майонез', calories: 680, protein: 1, carbs: 0.6, fat: 75, servings: [{ label: '1 tbsp', labelMn: '1 халбага', grams: 15, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },

  // === Beverages ===
  { name: 'Black tea', nameMn: 'Хар цай', calories: 1, protein: 0, carbs: 0.3, fat: 0, servings: [{ label: '1 cup', labelMn: '1 аяга', grams: 250, isDefault: true }, { label: '100ml', labelMn: '100мл', grams: 100 }] },
  { name: 'Green tea', nameMn: 'Ногоон цай', calories: 1, protein: 0, carbs: 0, fat: 0, servings: [{ label: '1 cup', labelMn: '1 аяга', grams: 250, isDefault: true }, { label: '100ml', labelMn: '100мл', grams: 100 }] },
  { name: 'Coffee (black)', nameMn: 'Хар кофе', calories: 2, protein: 0.3, carbs: 0, fat: 0, servings: [{ label: '1 cup', labelMn: '1 аяга', grams: 240, isDefault: true }, { label: '100ml', labelMn: '100мл', grams: 100 }] },
  { name: 'Coca-Cola', nameMn: 'Кока-Кола', calories: 42, protein: 0, carbs: 10.6, fat: 0, servings: [{ label: '1 can', labelMn: '1 лаазтай', grams: 330, isDefault: true }, { label: '100ml', labelMn: '100мл', grams: 100 }] },
  { name: 'Orange juice', nameMn: 'Жүржийн шүүс', calories: 45, protein: 0.7, carbs: 10, fat: 0.2, servings: [{ label: '1 glass', labelMn: '1 стакан', grams: 250, isDefault: true }, { label: '100ml', labelMn: '100мл', grams: 100 }] },
  { name: 'Beer', nameMn: 'Шар айраг', calories: 43, protein: 0.5, carbs: 3.6, fat: 0, servings: [{ label: '1 bottle', labelMn: '1 шил', grams: 500, isDefault: true }, { label: '100ml', labelMn: '100мл', grams: 100 }] },
  { name: 'Vodka', nameMn: 'Архи', calories: 231, protein: 0, carbs: 0, fat: 0, servings: [{ label: '1 shot', labelMn: '1 буланд', grams: 45, isDefault: true }, { label: '100ml', labelMn: '100мл', grams: 100 }] },

  // === Nuts & Seeds ===
  { name: 'Sunflower seeds', nameMn: 'Наранцэцэгийн үр', calories: 584, protein: 21, carbs: 20, fat: 51, servings: [{ label: '1 handful', labelMn: '1 атга', grams: 30, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Pine nuts', nameMn: 'Хушны самар', calories: 673, protein: 14, carbs: 13, fat: 68, servings: [{ label: '1 handful', labelMn: '1 атга', grams: 20, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Walnuts', nameMn: 'Грек самар', calories: 654, protein: 15, carbs: 14, fat: 65, servings: [{ label: '1 handful', labelMn: '1 атга', grams: 30, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Peanuts', nameMn: 'Газрын самар', calories: 567, protein: 26, carbs: 16, fat: 49, servings: [{ label: '1 handful', labelMn: '1 атга', grams: 30, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },

  // === Legumes ===
  { name: 'Lentils (cooked)', nameMn: 'Шош (чанасан)', calories: 116, protein: 9, carbs: 20, fat: 0.4, servings: [{ label: '1 cup', labelMn: '1 аяга', grams: 200, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Chickpeas (cooked)', nameMn: 'Нохойн хошуу буурцаг', calories: 164, protein: 9, carbs: 27, fat: 2.6, servings: [{ label: '1 cup', labelMn: '1 аяга', grams: 200, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },

  // === Modern/Fast Food ===
  { name: 'Pizza (cheese)', nameMn: 'Пицца', calories: 266, protein: 11, carbs: 33, fat: 10, servings: [{ label: '1 slice', labelMn: '1 зүсэм', grams: 120, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Hamburger', nameMn: 'Гамбургер', calories: 295, protein: 17, carbs: 24, fat: 14, servings: [{ label: '1 burger', labelMn: '1 ширхэг', grams: 200, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'French fries', nameMn: 'Шарсан төмс', calories: 312, protein: 3.4, carbs: 41, fat: 15, servings: [{ label: '1 medium', labelMn: '1 дунд', grams: 150, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Fried chicken', nameMn: 'Шарсан тахиа', calories: 320, protein: 22, carbs: 15, fat: 20, servings: [{ label: '1 piece', labelMn: '1 ширхэг', grams: 130, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Sushi roll', nameMn: 'Суши', calories: 140, protein: 4, carbs: 25, fat: 2.5, servings: [{ label: '6 pieces', labelMn: '6 ширхэг', grams: 180, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },

  // === Supplements / Fitness ===
  { name: 'Whey protein shake', nameMn: 'Уураг нэмэлт', calories: 120, protein: 25, carbs: 3, fat: 1.5, servings: [{ label: '1 scoop', labelMn: '1 хэмжүүр', grams: 32, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Protein bar', nameMn: 'Протейн бар', calories: 200, protein: 20, carbs: 22, fat: 7, servings: [{ label: '1 bar', labelMn: '1 ширхэг', grams: 60, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },

  // === More Traditional ===
  { name: 'Shorlog (kebab)', nameMn: 'Шорлог', calories: 230, protein: 22, carbs: 2, fat: 15, servings: [{ label: '1 skewer', labelMn: '1 шиш', grams: 120, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Piroshki (fried pie)', nameMn: 'Пирожок', calories: 340, protein: 8, carbs: 38, fat: 18, servings: [{ label: '1 piece', labelMn: '1 ширхэг', grams: 100, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
  { name: 'Manti (steamed bun)', nameMn: 'Манты', calories: 200, protein: 10, carbs: 20, fat: 9, servings: [{ label: '1 piece', labelMn: '1 ширхэг', grams: 80, isDefault: true }, { label: '100g', labelMn: '100г', grams: 100 }] },
];

async function main() {
  console.log(`Seeding ${FOODS.length} foods...`);

  let created = 0;
  let skipped = 0;

  for (const food of FOODS) {
    const existing = await prisma.food.findFirst({
      where: { normalizedName: food.name },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.food.create({
      data: {
        normalizedName: food.name,
        locale: 'mn',
        sourceType: 'admin',
        status: 'approved',
        servings: {
          create: food.servings.map((s) => ({
            label: s.label,
            labelMn: s.labelMn,
            gramsPerUnit: s.grams,
            isDefault: s.isDefault ?? false,
          })),
        },
        nutrients: {
          create: {
            caloriesPer100g: food.calories,
            proteinPer100g: food.protein,
            carbsPer100g: food.carbs,
            fatPer100g: food.fat,
            fiberPer100g: food.fiber ?? 0,
          },
        },
        localizations: {
          create: [
            { locale: 'mn', name: food.nameMn },
            { locale: 'en', name: food.name },
          ],
        },
        aliases: {
          create: [
            { alias: food.nameMn.toLowerCase(), locale: 'mn' },
          ],
        },
      },
    });

    created++;
  }

  console.log(`Seed complete: ${created} created, ${skipped} skipped (already exist).`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
