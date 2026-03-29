import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { en } from './en';
import { mn } from './mn';

const LOCALE_KEY = '@coach/locale';

export type Locale = 'en' | 'mn';

const translations = { en, mn } as Record<Locale, Record<string, unknown>>;

let currentLocale: Locale = 'mn';

export function t(key: string): string {
  const parts = key.split('.');
  let value: unknown = translations[currentLocale];
  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = (value as Record<string, unknown>)[part];
    } else {
      return key;
    }
  }
  return typeof value === 'string' ? value : key;
}

export async function setLocale(locale: Locale): Promise<void> {
  currentLocale = locale;
  await AsyncStorage.setItem(LOCALE_KEY, locale);
}

export async function getLocale(): Promise<Locale> {
  try {
    const stored = await AsyncStorage.getItem(LOCALE_KEY);
    if (stored === 'en' || stored === 'mn') {
      currentLocale = stored;
      return stored;
    }
  } catch {
    // Ignore
  }
  return 'mn';
}

export function useLocale(): {
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
  t: (key: string) => string;
} {
  const [locale, setLocaleState] = useState<Locale>(currentLocale);

  useEffect(() => {
    getLocale().then((l) => {
      currentLocale = l;
      setLocaleState(l);
    });
  }, []);

  const setLocaleCallback = useCallback(async (l: Locale) => {
    await setLocale(l);
    setLocaleState(l);
  }, []);

  const tCallback = useCallback((key: string) => t(key), [locale]);

  return {
    locale,
    setLocale: setLocaleCallback,
    t: tCallback,
  };
}
