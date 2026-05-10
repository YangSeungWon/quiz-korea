import { useCallback, useMemo, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Locale, TranslationStrings } from './types';
import { I18nContext } from './context';
import { applyPostpositions } from './postposition';
import ko from './ko';
import en from './en';

const translations: Record<Locale, TranslationStrings> = { ko, en };

const VALID: ReadonlySet<Locale> = new Set<Locale>(['ko', 'en']);

// Read locale from the first segment of the URL path. Fallback for non-prefixed
// pages (e.g. /maps/print/...) is derived from browser/localStorage so static
// prerender of those pages still picks something sensible.
function readLocaleFromPath(): Locale | null {
  if (typeof window === 'undefined') return null;
  const seg = window.location.pathname.split('/')[1];
  if (seg === 'ko' || seg === 'en') return seg;
  return null;
}

function fallbackLocale(): Locale {
  if (typeof window === 'undefined') return 'ko';
  // 1. legacy ?lang= override (only meaningful before LegacyRedirect runs)
  const params = new URLSearchParams(window.location.search);
  const langParam = params.get('lang');
  if (langParam === 'en' || langParam === 'ko') return langParam;
  // 2. localStorage
  const stored = localStorage.getItem('locale');
  if (stored === 'en' || stored === 'ko') return stored;
  // 3. browser
  if (navigator.language?.startsWith('ko')) return 'ko';
  if (navigator.languages?.some((l) => l.startsWith('ko'))) return 'ko';
  return 'en';
}

function detectLocale(): Locale {
  return readLocaleFromPath() ?? fallbackLocale();
}

export function I18nProvider({ children }: { children: ReactNode }) {
  // We re-evaluate on each navigation by listening to popstate + a custom
  // 'locationchange' event we dispatch from the LanguageToggle. React Router's
  // navigate() doesn't fire popstate, so a separate Provider listener via
  // useLocation() inside the tree is what actually keeps this in sync — see
  // `LocaleSyncBridge` below.
  const [locale, setLocaleState] = useState<Locale>(detectLocale);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    if (typeof window !== 'undefined') {
      localStorage.setItem('locale', newLocale);
      document.documentElement.lang = newLocale;
    }
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = locale;
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

  return (
    <I18nContext.Provider value={value}>
      <LocaleSyncBridge currentLocale={locale} onChange={setLocaleState} />
      {children}
    </I18nContext.Provider>
  );
}

// Keeps `locale` state in sync with the URL path. Sits inside the Router tree
// so it sees navigations triggered by react-router's navigate().
import { useLocation } from 'react-router-dom';
function LocaleSyncBridge({
  currentLocale,
  onChange,
}: {
  currentLocale: Locale;
  onChange: (l: Locale) => void;
}) {
  const location = useLocation();
  useEffect(() => {
    const seg = location.pathname.split('/')[1];
    if ((seg === 'ko' || seg === 'en') && seg !== currentLocale) {
      onChange(seg);
    }
  }, [location.pathname, currentLocale, onChange]);
  return null;
}

export { VALID as VALID_LOCALES };
