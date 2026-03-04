export const mn = {
  common: {
    save: 'Хадгалах',
    cancel: 'Цуцлах',
    delete: 'Устгах',
    retry: 'Дахин оролдох',
    loading: 'Ачааллаж байна...',
    error: 'Алдаа гарлаа',
  },
  tabs: {
    home: 'Нүүр',
    log: 'Бичлэг',
    search: 'Хайлт',
    progress: 'Дэвшил',
    settings: 'Тохиргоо',
  },
  dashboard: {
    greeting: 'Өглөөний мэнд',
    caloriesLeft: 'калори үлдсэн',
    protein: 'Уураг',
    carbs: 'Нүүрс ус',
    fat: 'Өөх тос',
  },
  logging: {
    logMeal: 'Хоол бүртгэх',
    textSearch: 'Текст хайлт',
    quickAdd: 'Түргэн нэмэх',
    scanBarcode: 'Баркод уншуулах',
    voice: 'Дуу',
    photo: 'Зураг',
    addToLog: 'Бичлэгт нэмэх',
  },
  onboarding: {
    trackNutrition: 'Хоолны дэглэмээ бүртгэ',
    aiInsights: 'AI-ийн шинжилгээ',
    telegramCoach: 'Telegram дасгалжуулагч',
    reachGoals: 'Зорилгоо биелүүл',
    getStarted: 'Эхлэх',
    skip: 'Алгасах',
    next: 'Дараах',
  },
  auth: {
    signIn: 'Нэвтрэх',
    signUp: 'Бүртгүүлэх',
    email: 'Имэйл',
    password: 'Нууц үг',
    forgotPassword: 'Нууц үгээ мартсан уу?',
  },
  settings: {
    language: 'Хэл',
    units: 'Нэгж',
    notifications: 'Мэдэгдэл',
    privacy: 'Нууцлал',
    signOut: 'Гарах',
  },
} as const;

export type MnTranslations = typeof mn;
