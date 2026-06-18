import type { RecordEntry } from './records';
import type { Locale } from '../i18n/types';
import { SIDO_SLUG, SIDO_SHORT, getSigunguName, getSidoMeta } from './regionUtils';
import { SIDO_SHORT_EN } from '../i18n/regions/sido';

// Lang-less replay path for a record (quiz only — learn produces no records).
export function recordReplayPath(e: RecordEntry): string {
  const seg = e.adminLevel === 'dong'
    ? (e.filter ? `/${e.filter}` : '')
    : (e.filter && SIDO_SLUG[e.filter] ? `/${SIDO_SLUG[e.filter]}` : '');
  const params = new URLSearchParams();
  if (e.count > 0) params.set('count', String(e.count));
  if (e.mode === 'pin') {
    if (e.borderless) params.set('borderless', '1');
    if (e.noAccum) params.set('noaccum', '1');
  }
  if (e.mode === 'type' && e.outline) params.set('outline', '1');
  const qs = params.toString();
  const base = `/quiz/${e.mode}/${e.adminLevel}${seg}/`;
  return qs ? `${base}?${qs}` : base;
}

// Region label for a record (e.g. "경기", "수원시"); "" for 전국.
export function recordRegionLabel(e: RecordEntry, locale: Locale): string {
  if (!e.filter) return '';
  if (e.adminLevel === 'dong') return getSigunguName(e.filter, locale);
  const meta = getSidoMeta(e.filter);
  if (meta) return locale === 'en' ? meta.shortNameEn : meta.shortName;
  // Codes without a slug (e.g. 세종) — fall back to the short name maps.
  return (locale === 'en' ? SIDO_SHORT_EN[e.filter] : SIDO_SHORT[e.filter]) || '';
}
