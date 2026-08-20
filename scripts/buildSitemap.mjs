/**
 * Generate public/sitemap.xml from the canonical URL set.
 *
 * Each lang-less path is emitted as one <url> per locale (ko, en) — 2 entries
 * per path. Each entry carries hreflang alternates for both locales plus
 * x-default (defaults to ko).
 */

import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LOCALES,
  QUIZ_MODES,
  LEVELS,
  METRO_SLUGS,
  PROVINCE_SLUGS,
  loadDongScopeCodes,
} from './regionSlugs.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = join(__dirname, '..', 'public', 'sitemap.xml');
const BASE = 'https://quiz-korea.ysw.kr';
const X_DEFAULT_LOCALE = 'ko';

// Build the lang-less path set. Priorities are tuned so that landing > base
// pages > filtered pages > deep filtered.

function buildPaths(dongCodes) {
  const paths = [];
  paths.push({ path: '/', priority: 1.0 });

  for (const mode of QUIZ_MODES) {
    for (const level of LEVELS) {
      paths.push({ path: `/quiz/${mode}/${level}/`, priority: 0.8 });
    }
    for (const slug of METRO_SLUGS) {
      paths.push({ path: `/quiz/${mode}/sigungu/${slug}/`, priority: 0.7 });
    }
    for (const slug of PROVINCE_SLUGS) {
      paths.push({ path: `/quiz/${mode}/sigun/${slug}/`, priority: slug === 'gyeonggi' ? 0.7 : 0.6 });
    }
  }

  for (const level of LEVELS) {
    paths.push({ path: `/learn/${level}/`, priority: 0.8 });
  }
  for (const slug of METRO_SLUGS) {
    paths.push({ path: `/learn/sigungu/${slug}/`, priority: 0.6 });
  }
  for (const slug of PROVINCE_SLUGS) {
    paths.push({ path: `/learn/sigun/${slug}/`, priority: slug === 'gyeonggi' ? 0.6 : 0.5 });
  }

  // /maps/sigungu (전국 시군구) is intentionally not generated — too dense.
  paths.push({ path: '/maps/sido/', priority: 0.9 });
  paths.push({ path: '/maps/sigun/', priority: 0.9 });
  for (const slug of METRO_SLUGS) {
    paths.push({ path: `/maps/sigungu/${slug}/`, priority: 0.7 });
  }
  for (const slug of PROVINCE_SLUGS) {
    paths.push({ path: `/maps/sigun/${slug}/`, priority: slug === 'gyeonggi' ? 0.7 : 0.6 });
  }
  for (const slug of PROVINCE_SLUGS) {
    paths.push({ path: `/maps/sigungu/${slug}/`, priority: slug === 'gyeonggi' ? 0.7 : 0.6 });
  }

  // 읍면동 quiz/learn pages (per 시군구 / 시-전체 code). Long-tail, low priority.
  for (const code of dongCodes) {
    paths.push({ path: `/quiz/pin/dong/${code}/`, priority: 0.4 });
    paths.push({ path: `/quiz/type/dong/${code}/`, priority: 0.3 });
    paths.push({ path: `/learn/dong/${code}/`, priority: 0.3 });
  }

  return paths;
}

function buildXml(dongCodes) {
  const paths = buildPaths(dongCodes);
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ];

  for (const { path, priority } of paths) {
    for (const locale of LOCALES) {
      const loc = `${BASE}/${locale}${path === '/' ? '/' : path}`;
      const koUrl = `${BASE}/ko${path === '/' ? '/' : path}`;
      const enUrl = `${BASE}/en${path === '/' ? '/' : path}`;
      const xDefault = X_DEFAULT_LOCALE === 'ko' ? koUrl : enUrl;
      lines.push('  <url>');
      lines.push(`    <loc>${loc}</loc>`);
      lines.push(`    <xhtml:link rel="alternate" hreflang="ko" href="${koUrl}" />`);
      lines.push(`    <xhtml:link rel="alternate" hreflang="en" href="${enUrl}" />`);
      lines.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${xDefault}" />`);
      lines.push('    <changefreq>monthly</changefreq>');
      lines.push(`    <priority>${priority.toFixed(1)}</priority>`);
      lines.push('  </url>');
    }
  }

  lines.push('</urlset>', '');
  return lines.join('\n');
}

const dongCodes = await loadDongScopeCodes();
const xml = buildXml(dongCodes);
await writeFile(OUTPUT, xml, 'utf-8');
const urlCount = xml.match(/<loc>/g)?.length ?? 0;
console.log(`Wrote ${OUTPUT} (${urlCount} URLs)`);
