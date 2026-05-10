import { useEffect } from 'react';
import { useI18n } from '../i18n/useI18n';

const BASE_URL = 'https://quiz-korea.ysw.kr';

function setMeta(nameOrProperty: string, content: string, attr: 'name' | 'property' = 'name') {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${nameOrProperty}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, nameOrProperty);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLink(rel: string, href: string, hreflang?: string) {
  // Match by rel + hreflang to allow multiple alternate links to coexist.
  const selector = hreflang
    ? `link[rel="${rel}"][hreflang="${hreflang}"]`
    : `link[rel="${rel}"]:not([hreflang])`;
  let el = document.querySelector<HTMLLinkElement>(selector);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    if (hreflang) el.setAttribute('hreflang', hreflang);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/**
 * Set page meta + canonical + hreflang alternates.
 *
 * `path` is a lang-less canonical path (e.g. `/quiz/pin/sido/`). The hook
 * prepends the current locale to build the canonical and emits hreflang
 * alternates for both languages plus x-default (defaults to ko).
 */
export function usePageMeta({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}) {
  const { locale } = useI18n();
  useEffect(() => {
    const langlessPath = path === '/' ? '/' : path.startsWith('/') ? path : `/${path}`;
    const koUrl = `${BASE_URL}/ko${langlessPath === '/' ? '/' : langlessPath}`;
    const enUrl = `${BASE_URL}/en${langlessPath === '/' ? '/' : langlessPath}`;
    const canonical = locale === 'ko' ? koUrl : enUrl;

    document.title = title;
    setMeta('description', description);
    setMeta('og:title', title, 'property');
    setMeta('og:description', description, 'property');
    setMeta('og:url', canonical, 'property');

    setLink('canonical', canonical);
    setLink('alternate', koUrl, 'ko');
    setLink('alternate', enUrl, 'en');
    setLink('alternate', koUrl, 'x-default');
  }, [title, description, path, locale]);
}
