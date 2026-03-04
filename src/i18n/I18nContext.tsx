import { useState, useCallback, useMemo, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Locale, TranslationStrings } from './types';
import { I18nContext } from './context';
import { applyPostpositions } from './postposition';
import ko from './ko';
import en from './en';

const translations: Record<Locale, TranslationStrings> = { ko, en };

function detectLocale(): Locale {
  // 1. ?lang= query param
  const params = new URLSearchParams(window.location.search);
  const langParam = params.get('lang');
  if (langParam === 'en' || langParam === 'ko') return langParam;

  // 2. localStorage
  const stored = localStorage.getItem('locale');
  if (stored === 'en' || stored === 'ko') return stored;

  // 3. Browser language (check primary + all preferred languages)
  if (navigator.language.startsWith('ko')) return 'ko';
  if (navigator.languages?.some((l) => l.startsWith('ko'))) return 'ko';

  return 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('locale', newLocale);
    document.documentElement.lang = newLocale;
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback(
    (key: keyof TranslationStrings, params?: Record<string, string | number>): string => {
      let str = translations[locale][key];
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          str = str.replace(`{${k}}`, String(v));
        }
      }
      if (locale === 'ko') str = applyPostpositions(str);
      return str;
    },
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
