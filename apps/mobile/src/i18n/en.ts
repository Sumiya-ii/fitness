export const en = {
  common: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    retry: 'Retry',
    loading: 'Loading...',
    error: 'Something went wrong',
  },
  tabs: {
    home: 'Home',
    log: 'Log',
    search: 'Search',
    progress: 'Progress',
    settings: 'Settings',
  },
  dashboard: {
    greeting: 'Good morning',
    caloriesLeft: 'calories left',
    protein: 'Protein',
    carbs: 'Carbs',
    fat: 'Fat',
  },
  logging: {
    logMeal: 'Log a Meal',
    textSearch: 'Text Search',
    quickAdd: 'Quick Add',
    scanBarcode: 'Scan Barcode',
    voice: 'Voice',
    photo: 'Photo',
    addToLog: 'Add to Log',
  },
  onboarding: {
    trackNutrition: 'Track Your Nutrition',
    aiInsights: 'AI-Powered Insights',
    telegramCoach: 'Telegram Coach',
    reachGoals: 'Reach Your Goals',
    getStarted: 'Get Started',
    skip: 'Skip',
    next: 'Next',
  },
  auth: {
    signIn: 'Sign In',
    signUp: 'Create Account',
    email: 'Email',
    password: 'Password',
    forgotPassword: 'Forgot Password?',
  },
  settings: {
    language: 'Language',
    units: 'Units',
    notifications: 'Notifications',
    privacy: 'Privacy',
    signOut: 'Sign Out',
  },
} as const;

export type EnTranslations = typeof en;
