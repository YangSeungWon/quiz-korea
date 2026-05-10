import { useCallback } from 'react';
import { useI18n } from '../i18n/useI18n';

/**
 * Hook returning a function that prepends the current `/${locale}` prefix to a
 * lang-less path (e.g. `/quiz/pin/sido/`). Use for all internal navigation so
 * we keep visitors on their language.
 *
 *   const localized = useLocalePath();
 *   navigate(localized('/quiz/pin/sido/'));
 *
 * Pass-through behavior:
 * - If `path` already starts with `/ko/` or `/en/`, returned as-is.
 * - If `path` is a query-string-only path (`?foo=bar`), returned as-is.
 */
export function useLocalePath() {
  const { locale } = useI18n();
  return useCallback(
    (path: string): string => {
      if (!path.startsWith('/')) return path;
      if (path === '/') return `/${locale}/`;
      if (path.startsWith('/ko/') || path.startsWith('/en/')) return path;
      return `/${locale}${path}`;
    },
    [locale],
  );
}
