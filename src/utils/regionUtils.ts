import type { Locale } from '../i18n/types';
import type { RegionCollection, RegionFeature, QuizRegion } from '../types';
import { SIDO_MAP_EN, SIDO_SHORT_EN, SIDO_SHORT_FORMS_EN } from '../i18n/regions/sido';
import { SIGUNGU_NAMES_EN, DUPLICATE_NAMES_EN } from '../i18n/regions/en';

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

// Sigungu names that exist in multiple sido — only these get prefixed
const DUPLICATE_NAMES = new Set(['중구', '동구', '서구', '남구', '북구', '강서구', '고성군']);

// Get display name: prefix with sido short name only when the name is ambiguous
export function getDisplayName(feature: RegionFeature, locale: Locale = 'ko'): string {
  // Sigun merged features have their own name
  if (feature.properties.SIGUN_NAME_EN && locale === 'en') {
    return feature.properties.SIGUN_NAME_EN as string;
  }

  if (locale === 'en') {
    const code = getRegionCode(feature);
    const enName = SIGUNGU_NAMES_EN[code];
    if (enName && DUPLICATE_NAMES_EN.has(enName)) {
      if (code.length >= 2) {
        const prefix = SIDO_SHORT_EN[code.substring(0, 2)];
        if (prefix) return `${prefix} ${enName}`;
      }
    }
    return enName || SIDO_MAP_EN[code] || getRegionName(feature);
  }

  const name = getRegionName(feature);
  if (DUPLICATE_NAMES.has(name)) {
    const code = feature.properties.SIG_CD || getRegionCode(feature);
    if (code.length >= 2) {
      const prefix = SIDO_SHORT[code.substring(0, 2)];
      if (prefix) return `${prefix} ${name}`;
    }
  }
  return name;
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
