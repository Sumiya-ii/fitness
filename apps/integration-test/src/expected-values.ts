/**
 * Expected value ranges for each test audio file.
 *
 * Ranges are intentionally generous because:
 *   - Whisper may transcribe quantities differently ("2-3" vs "2, 3")
 *   - GPT-4o-mini nutrition estimates vary between runs
 *   - Non-reference foods (banana, kiwi, Chipotle) use general knowledge
 */

export interface ExpectedRange {
  label: string;
  /** Substrings that MUST appear in transcript (case-insensitive) */
  transcriptMustInclude: string[];
  /** At least one of these must appear in transcript */
  transcriptMayInclude?: string[];
  expectedItemCount: [number, number];
  /** Expected meal type. 'any' = don't assert */
  mealType: string | null | 'any';
  totalCalories: [number, number];
  totalProtein: [number, number];
  totalCarbs: [number, number];
  totalFat: [number, number];
}

export const AUDIO_FILES: Record<string, ExpectedRange> = {
  // "Өнөөдөр би 2,3-н өндөг идлээ" — 2-3 eggs
  // egg = 70 cal, 6g protein, 0.5g carbs, 5g fat per piece
  // Whisper variants: өндөг → өндөөг, өндо
  '01-eggs.wav': {
    label: '2-3 eggs',
    transcriptMustInclude: [],
    transcriptMayInclude: ['өндөг', 'өндөө', 'өнхдөө', 'гурав', 'хайр', 'идлээ', 'эдлээ'],
    expectedItemCount: [1, 3],
    mealType: 'any',
    totalCalories: [70, 500],
    totalProtein: [5, 40],
    totalCarbs: [0, 15],
    totalFat: [3, 35],
  },

  // "За bro нь өнөөдөр 4 талх, 3 banana идлээ"
  // bread slice = 70 cal, 2g prot, 13g carbs, 1g fat
  // banana ~105 cal, 1.3g prot, 27g carbs, 0.4g fat
  '02-bread-bananas.wav': {
    label: '4 bread, 3 bananas',
    transcriptMustInclude: ['талх'],
    transcriptMayInclude: ['banana', 'банан', 'бана', '4', '3', 'дөрвөн', 'гурван'],
    expectedItemCount: [2, 3],
    mealType: 'any',
    totalCalories: [350, 800],
    totalProtein: [5, 20],
    totalCarbs: [60, 170],
    totalFat: [2, 15],
  },

  // "1 таваг цуйван ~200g + 3 өргөст хэмх" (dinner)
  // tsuivan 550 cal/bowl (350g), scaled to 200g ~314 cal
  // kiwi ~61 cal each
  // Whisper variants: цуйван → цөвөн, цөвөг, цүйвэн
  '03-tsuivan-kiwi.wav': {
    label: '1 tsuivan 200g + 3 kiwis',
    transcriptMustInclude: [],
    transcriptMayInclude: ['цуйван', 'цөвөн', 'цөвөг', 'тавг', 'тавук', 'орой', 'грамм'],
    expectedItemCount: [1, 5],
    mealType: 'dinner',
    totalCalories: [200, 1400],
    totalProtein: [5, 80],
    totalCarbs: [20, 140],
    totalFat: [3, 50],
  },

  // "4 хуушуур, 5 аяга банштай цай" (breakfast)
  // khuushuur = 120 cal/piece; banshtai tsai varies widely
  // Whisper variants: хуушуур → хушуур, хошуур, хошоор
  '04-khuushuur-banshtai-tsai.wav': {
    label: '4 khuushuur + 5 cups banshtai tsai',
    transcriptMustInclude: [],
    transcriptMayInclude: ['хуушуур', 'хушуур', 'хошуур', 'хошоор', 'банш', 'цай'],
    expectedItemCount: [2, 4],
    mealType: 'breakfast',
    totalCalories: [150, 1800],
    totalProtein: [10, 100],
    totalCarbs: [15, 150],
    totalFat: [5, 70],
  },

  // "1 Chipotle chicken bowl" (lunch)
  // Chipotle bowl ~740 cal typical, but LLM may vary
  // Whisper variants: chipotle → жипатла, жіпотлі
  '05-chipotle-bowl.wav': {
    label: '1 Chipotle chicken bowl',
    transcriptMustInclude: [],
    transcriptMayInclude: ['chipotle', 'жипатл', 'тахиа', 'bowl', 'бол', 'ширхэг'],
    expectedItemCount: [1, 5],
    mealType: 'any',
    totalCalories: [300, 1000],
    totalProtein: [15, 70],
    totalCarbs: [20, 120],
    totalFat: [5, 45],
  },
};

/** Known transcript texts for LLM-only tests (bypasses Whisper) */
export const KNOWN_TRANSCRIPTS: Record<string, string> = {
  '01-eggs': 'Өнөөдөр би 2-3н өндөг идлээ',
  '02-bread-bananas': 'За bro нь өнөөдөр 4 талх, 3 banana идлээ',
  '03-tsuivan-kiwi':
    'За оройн хоолондоо 1 цуйван, 1 таваг цуйван ойролцоогоор 200 грамм, за тэгээд 3 өргөст хэмхтэй хамт идлээ',
  '04-khuushuur-banshtai': 'За өнөөдөр өглөөний цайндаа 4 хуушуур, 5 аяга банштай цай идлээ',
  '05-chipotle': 'За өдрийн хоолондоо chipotle-оос 1 ширхэг тахианы махтай bowl авч идлээ',
};

/** Maps LLM-only test keys to audio file keys */
export const TRANSCRIPT_TO_AUDIO: Record<string, string> = {
  '01-eggs': '01-eggs.wav',
  '02-bread-bananas': '02-bread-bananas.wav',
  '03-tsuivan-kiwi': '03-tsuivan-kiwi.wav',
  '04-khuushuur-banshtai': '04-khuushuur-banshtai-tsai.wav',
  '05-chipotle': '05-chipotle-bowl.wav',
};
