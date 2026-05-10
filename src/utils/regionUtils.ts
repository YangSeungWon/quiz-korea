import type { Locale } from '../i18n/types';
import type { RegionCollection, RegionFeature, QuizRegion } from '../types';
import { SIDO_MAP_EN, SIDO_SHORT_EN, SIDO_SHORT_FORMS_EN } from '../i18n/regions/sido';
import { SIGUNGU_NAMES_EN } from '../i18n/regions/en';

// Extract code from feature properties (fallback chain)
export function getRegionCode(feature: RegionFeature): string {
  return feature.properties.CTPRVN_CD || feature.properties.SIG_CD || feature.properties.code || '';
}

// Extract Korean name from feature properties (fallback chain)
export function getRegionName(feature: RegionFeature): string {
  return feature.properties.CTP_KOR_NM || feature.properties.SIG_KOR_NM || feature.properties.name || '';
}

// Get region name for the given locale
export function getRegionNameLocale(feature: RegionFeature, locale: Locale = 'ko'): string {
  if (locale === 'ko') return getRegionName(feature);

  const code = getRegionCode(feature);
  // Sigun merged feature
  if (feature.properties.SIGUN_NAME_EN) return feature.properties.SIGUN_NAME_EN as string;
  // Try sigungu lookup first
  if (SIGUNGU_NAMES_EN[code]) return SIGUNGU_NAMES_EN[code];
  // Try sido lookup
  if (SIDO_MAP_EN[code]) return SIDO_MAP_EN[code];
  // Fallback to CTP_ENG_NM property or Korean
  return feature.properties.CTP_ENG_NM as string || getRegionName(feature);
}

// Extract QuizRegion[] from GeoJSON, optionally filtering by sido
export function extractRegions(
  geoData: RegionCollection,
  sidoFilter?: string,
  locale: Locale = 'ko',
): QuizRegion[] {
  let features = geoData.features;

  if (sidoFilter) {
    features = features.filter((f) => {
      const sigCode = f.properties.SIG_CD || getRegionCode(f);
      return sigCode.startsWith(sidoFilter);
    });
  }

  return features.map((f) => ({
    code: getRegionCode(f),
    name: f.properties.SIG_KOR_NM ? getDisplayName(f, locale) : getRegionNameLocale(f, locale),
    feature: f,
  }));
}

// Sido code-to-name mapping
export const SIDO_MAP: Record<string, string> = {
  '11': '서울특별시',
  '26': '부산광역시',
  '27': '대구광역시',
  '28': '인천광역시',
  '29': '광주광역시',
  '30': '대전광역시',
  '31': '울산광역시',
  '36': '세종특별자치시',
  '41': '경기도',
  '42': '강원특별자치도',
  '43': '충청북도',
  '44': '충청남도',
  '45': '전북특별자치도',
  '46': '전라남도',
  '47': '경상북도',
  '48': '경상남도',
  '50': '제주특별자치도',
};

// Short-form matching for sido names (Korean)
const SIDO_SHORT_FORMS: Record<string, string> = {
  '서울': '서울특별시',
  '부산': '부산광역시',
  '대구': '대구광역시',
  '인천': '인천광역시',
  '광주': '광주광역시',
  '대전': '대전광역시',
  '울산': '울산광역시',
  '세종': '세종특별자치시',
  '경기': '경기도',
  '강원': '강원특별자치도',
  '충북': '충청북도',
  '충남': '충청남도',
  '전북': '전북특별자치도',
  '전남': '전라남도',
  '경북': '경상북도',
  '경남': '경상남도',
  '제주': '제주특별자치도',
};

// Sido code → short name for prefixing duplicates
export const SIDO_SHORT: Record<string, string> = {
  '11': '서울',
  '26': '부산',
  '27': '대구',
  '28': '인천',
  '29': '광주',
  '30': '대전',
  '31': '울산',
  '41': '경기',
  '42': '강원',
  '43': '충북',
  '44': '충남',
  '45': '전북',
  '46': '전남',
  '47': '경북',
  '48': '경남',
  '50': '제주',
};

// Sido code → English slug for SEO-friendly URLs (e.g. ?sido=seoul)
// Sejong (36) is omitted since it's a single 자치시 with no meaningful filtered view.
export const SIDO_SLUG: Record<string, string> = {
  '11': 'seoul',
  '26': 'busan',
  '27': 'daegu',
  '28': 'incheon',
  '29': 'gwangju',
  '30': 'daejeon',
  '31': 'ulsan',
  '41': 'gyeonggi',
  '42': 'gangwon',
  '43': 'chungbuk',
  '44': 'chungnam',
  '45': 'jeonbuk',
  '46': 'jeonnam',
  '47': 'gyeongbuk',
  '48': 'gyeongnam',
  '50': 'jeju',
};

// Reverse: slug → admin code
export const SLUG_TO_SIDO: Record<string, string> = Object.fromEntries(
  Object.entries(SIDO_SLUG).map(([code, slug]) => [slug, code]),
);

// 광역시 codes (자치구). Others in SIDO_SLUG are 도 (시군).
const METRO_SIDO = new Set(['11', '26', '27', '28', '29', '30', '31']);
// 광역시 중에서 "군"을 포함하는 곳 — 부산·대구·인천·울산.
// 서울/광주/대전은 자치구만 있음.
const METRO_WITH_GUN = new Set(['26', '27', '28', '31']);

export interface SidoMeta {
  code: string;
  slug: string;
  shortName: string;
  shortNameEn: string;
  type: 'metro' | 'province';
  // User-facing label that matches actual administrative composition:
  //  - 서울/광주/대전 → "구"     (자치구만)
  //  - 부산/대구/인천/울산 → "구·군" (자치구 + 군)
  //  - 도(province) → "시군"
  regionLabelKo: '구' | '구·군' | '시군';
  regionLabelEn: 'districts' | 'districts and counties' | 'cities';
}

export function getSidoMeta(codeOrSlug: string): SidoMeta | null {
  const code = SLUG_TO_SIDO[codeOrSlug] ?? codeOrSlug;
  if (!SIDO_SLUG[code]) return null;
  const isMetro = METRO_SIDO.has(code);
  const hasGun = METRO_WITH_GUN.has(code);
  return {
    code,
    slug: SIDO_SLUG[code],
    shortName: SIDO_SHORT[code],
    shortNameEn: SIDO_SHORT_EN[code] ?? '',
    type: isMetro ? 'metro' : 'province',
    regionLabelKo: isMetro ? (hasGun ? '구·군' : '구') : '시군',
    regionLabelEn: isMetro ? (hasGun ? 'districts and counties' : 'districts') : 'cities',
  };
}

/**
 * User-facing region label for an inhabited (sido, adminLevel) combo. The
 * SidoMeta.regionLabel covers the primary case (광역시 → 구/구·군, 도 → 시군),
 * but 도 also supports a sub-city sigungu view that should be labeled "시군구".
 */
export function getRegionLabel(
  sidoMeta: SidoMeta,
  adminLevel: 'sido' | 'sigun' | 'sigungu',
  locale: Locale = 'ko',
): string {
  // 광역시: regionLabel is correct regardless of adminLevel (sigun level meaningless).
  if (sidoMeta.type === 'metro') {
    return locale === 'en' ? sidoMeta.regionLabelEn : sidoMeta.regionLabelKo;
  }
  // 도 sigungu (e.g. 수원시 영통구) — finer subdivisions
  if (adminLevel === 'sigungu') {
    return locale === 'en' ? 'sub-divisions' : '시군구';
  }
  // 도 sigun — cities & counties
  return locale === 'en' ? 'cities' : '시군';
}

// Get display name: prefix with sido short name for all sigungu features
export function getDisplayName(feature: RegionFeature, locale: Locale = 'ko'): string {
  // Sigun merged features have their own name
  if (feature.properties.SIGUN_NAME_EN && locale === 'en') {
    const code = getRegionCode(feature);
    // Non-metro sigun: add sido prefix (e.g. "Gyeonggi Suwon-si")
    if (code.length > 2) {
      const prefix = SIDO_SHORT_EN[code.substring(0, 2)];
      if (prefix) return `${prefix} ${feature.properties.SIGUN_NAME_EN}`;
    }
    return feature.properties.SIGUN_NAME_EN as string;
  }

  if (locale === 'en') {
    const code = getRegionCode(feature);
    const enName = SIGUNGU_NAMES_EN[code];
    if (enName && code.length >= 2) {
      const prefix = SIDO_SHORT_EN[code.substring(0, 2)];
      if (prefix) return `${prefix} ${enName}`;
    }
    return enName || SIDO_MAP_EN[code] || getRegionName(feature);
  }

  const name = getRegionName(feature);
  const code = feature.properties.SIG_CD || getRegionCode(feature);
  if (code.length >= 4) {
    const prefix = SIDO_SHORT[code.substring(0, 2)];
    if (prefix) return `${prefix} ${name}`;
  }
  return name;
}

// Short name without sido prefix — useful inside zoomed insets where the inset
// label already establishes which 시도 is being shown.
export function getShortDisplayName(feature: RegionFeature, locale: Locale = 'ko'): string {
  if (locale === 'en') {
    if (feature.properties.SIGUN_NAME_EN) return feature.properties.SIGUN_NAME_EN as string;
    const code = getRegionCode(feature);
    return SIGUNGU_NAMES_EN[code] || SIDO_MAP_EN[code] || getRegionName(feature);
  }
  return getRegionName(feature);
}

// Korean suffixes stripped for compact sigun-level rendering. Order matters:
// longer compound suffixes first so we don't strip "시" from "특별시" prematurely.
const KO_COMPACT_SUFFIXES = ['특별자치도', '특별자치시', '광역시', '특별시', '시', '군', '도'];

function stripKoCompactSuffix(name: string): string {
  for (const suffix of KO_COMPACT_SUFFIXES) {
    if (name.endsWith(suffix) && name.length > suffix.length) {
      return name.slice(0, -suffix.length);
    }
  }
  return name;
}

// Compact form for sigun-level printable labels: drops 시/군/특별시/광역시/도 suffixes.
// "수원시" → "수원", "서울특별시" → "서울", "울릉군" → "울릉".
// Compound names ("수원시 영통구") shouldn't appear at sigun level, but if they do
// each whitespace-separated part is stripped independently.
export function getCompactDisplayName(feature: RegionFeature, locale: Locale = 'ko'): string {
  const short = getShortDisplayName(feature, locale);
  if (locale !== 'ko') return short;
  if (short.includes(' ')) {
    return short.split(' ').map(stripKoCompactSuffix).join(' ');
  }
  return stripKoCompactSuffix(short);
}

// Sigungu suffixes that can be dropped (Korean)
const SIGUNGU_SUFFIXES = ['특별시', '광역시', '특별자치시', '특별자치도', '시', '군', '구'];

// English suffixes that can be dropped
const SIGUNGU_SUFFIXES_EN = ['-gu', '-si', '-do', '-gun'];

// Check if user input matches a region name (supports short forms)
export function matchesRegionName(input: string, regionName: string, locale: Locale = 'ko'): boolean {
  const normalized = input.trim();
  if (!normalized) return false;

  if (locale === 'en') {
    const lower = normalized.toLowerCase();
    const target = regionName.toLowerCase();

    // Exact match (case-insensitive)
    if (lower === target) return true;

    // Without hyphens
    if (lower.replace(/-/g, '') === target.replace(/-/g, '')) return true;

    // Short-form sido match
    const fullName = SIDO_SHORT_FORMS_EN[lower];
    if (fullName && fullName.toLowerCase() === target) return true;

    // Metro-prefixed: "Seoul Jung-gu" → also accept "Jung-gu"
    const spaceIdx = regionName.indexOf(' ');
    if (spaceIdx !== -1) {
      const baseName = regionName.substring(spaceIdx + 1);
      if (matchesRegionName(normalized, baseName, 'en')) return true;
      // "SeoulJung-gu" (no space)
      const prefix = regionName.substring(0, spaceIdx);
      if (lower === (prefix + baseName).toLowerCase()) return true;
    }

    // Accept without suffix
    for (const suffix of SIGUNGU_SUFFIXES_EN) {
      if (target.endsWith(suffix)) {
        const withoutSuffix = target.slice(0, -suffix.length);
        if (withoutSuffix && lower === withoutSuffix) return true;
        // Without hyphen in input
        if (withoutSuffix && lower.replace(/-/g, '') === withoutSuffix.replace(/-/g, '')) return true;
      }
    }

    return false;
  }

  // Korean matching (original logic)

  // Exact match
  if (normalized === regionName) return true;

  // Short-form sido match
  const fullName = SIDO_SHORT_FORMS[normalized];
  if (fullName && fullName === regionName) return true;

  // Metro-prefixed name: "서울 중구" → also accept "서울중구", "중구", "중"
  const spaceIdx = regionName.indexOf(' ');
  if (spaceIdx !== -1) {
    const prefix = regionName.substring(0, spaceIdx);
    const baseName = regionName.substring(spaceIdx + 1);
    // "서울중구" (no space)
    if (normalized === prefix + baseName) return true;
    // Match against just the base name part
    if (matchesRegionName(normalized, baseName)) return true;
  }

  // Sigungu: accept without suffix
  for (const suffix of SIGUNGU_SUFFIXES) {
    if (regionName.endsWith(suffix)) {
      const withoutSuffix = regionName.slice(0, -suffix.length);
      if (withoutSuffix && normalized === withoutSuffix) return true;
    }
  }

  return false;
}

// Get sido list for sigungu filtering
export function getSidoList(geoData: RegionCollection, locale: Locale = 'ko'): Array<{ code: string; name: string }> {
  const sidoMap = new Map<string, string>();

  // Extended map to handle legacy codes (51=강원, 52=전북)
  const codeMapKo: Record<string, string> = {
    ...SIDO_MAP,
    '51': '강원특별자치도',
    '52': '전북특별자치도',
  };

  const codeMapEn: Record<string, string> = {
    ...SIDO_MAP_EN,
    '51': 'Gangwon-do',
    '52': 'Jeollabuk-do',
  };

  const codeMap = locale === 'en' ? codeMapEn : codeMapKo;

  for (const feature of geoData.features) {
    const sigCode = feature.properties.SIG_CD || '';
    if (sigCode.length >= 2) {
      const sidoCode = sigCode.substring(0, 2);
      const sidoName = codeMap[sidoCode];
      if (sidoName) {
        sidoMap.set(sidoCode, sidoName);
      }
    }
  }

  return Array.from(sidoMap.entries())
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.code.localeCompare(b.code));
}
