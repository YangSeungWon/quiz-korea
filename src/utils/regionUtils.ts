import type { RegionCollection, RegionFeature, QuizRegion } from '../types';

// Extract code from feature properties (fallback chain)
export function getRegionCode(feature: RegionFeature): string {
  return feature.properties.CTPRVN_CD || feature.properties.SIG_CD || feature.properties.code || '';
}

// Extract name from feature properties (fallback chain)
export function getRegionName(feature: RegionFeature): string {
  return feature.properties.CTP_KOR_NM || feature.properties.SIG_KOR_NM || feature.properties.name || '';
}

// Extract QuizRegion[] from GeoJSON, optionally filtering by sido
export function extractRegions(
  geoData: RegionCollection,
  sidoFilter?: string,
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
    name: getRegionName(f),
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

// Short-form matching for sido names
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

// Sigungu suffixes that can be dropped
const SIGUNGU_SUFFIXES = ['특별시', '광역시', '특별자치시', '특별자치도', '시', '군', '구'];

// Check if user input matches a region name (supports short forms)
export function matchesRegionName(input: string, regionName: string): boolean {
  const normalized = input.trim();
  if (!normalized) return false;

  // Exact match
  if (normalized === regionName) return true;

  // Short-form sido match
  const fullName = SIDO_SHORT_FORMS[normalized];
  if (fullName && fullName === regionName) return true;

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
export function getSidoList(geoData: RegionCollection): Array<{ code: string; name: string }> {
  const sidoMap = new Map<string, string>();

  // Extended map to handle legacy codes (51=강원, 52=전북)
  const codeMap: Record<string, string> = {
    ...SIDO_MAP,
    '51': '강원특별자치도',
    '52': '전북특별자치도',
  };

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
