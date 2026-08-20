/**
 * The region slug/code vocabulary shared by buildSitemap.mjs and prerender.mjs.
 *
 * These two scripts used to declare their own copies. They drifted: the sitemap
 * grew 읍면동 URLs (one per 시군구) while the pre-renderer never learned about
 * them, so 1584 of the 1754 advertised URLs answered with 404.html. Anything
 * both scripts must agree on lives here, so the next addition can only be made
 * in one place.
 */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const LOCALES = ['ko', 'en'];
export const QUIZ_MODES = ['pin', 'type'];
export const LEVELS = ['sido', 'sigun', 'sigungu'];
export const METRO_SLUGS = ['seoul', 'busan', 'daegu', 'incheon', 'gwangju', 'daejeon', 'ulsan'];
export const PROVINCE_SLUGS = [
  'gyeonggi', 'gangwon', 'chungbuk', 'chungnam', 'jeonbuk',
  'jeonnam', 'gyeongbuk', 'gyeongnam', 'jeju',
];

/**
 * 동(읍면동) scope codes from the sigungu data: every 5-digit 시군구 plus the
 * 4-digit 시-전체 code for 일반구 도시 (수원·성남 등, 여러 구가 4자리를 공유).
 */
export async function loadDongScopeCodes() {
  const file = join(__dirname, '..', 'public', 'data', 'korea-sigungu.json');
  const topo = JSON.parse(await readFile(file, 'utf-8'));
  const objKey = Object.keys(topo.objects)[0];
  const codes = topo.objects[objKey].geometries
    .map((g) => g.properties?.SIG_CD)
    .filter(Boolean);
  const countBy4 = new Map();
  for (const c of codes) countBy4.set(c.slice(0, 4), (countBy4.get(c.slice(0, 4)) ?? 0) + 1);
  const scopes = new Set(codes);
  for (const [p4, n] of countBy4) if (n > 1) scopes.add(p4); // 시-전체 (일반구 합본)
  return [...scopes].sort();
}
