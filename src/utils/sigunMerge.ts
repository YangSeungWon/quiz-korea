import * as topojson from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { RegionCollection, RegionFeature } from '../types';
import { SIDO_MAP } from './regionUtils';
import { SIDO_MAP_EN } from '../i18n/regions/sido';
import { SIGUNGU_NAMES_EN } from '../i18n/regions/en';

// Metro city codes — group all districts into one
const METRO_CODES = new Set(['11', '26', '27', '28', '29', '30', '31', '36']);

interface SigunGroup {
  groupKey: string;
  code: string; // representative code (first 2 digits for metro, first 4 for compound, full for standalone)
  nameKo: string;
  nameEn: string;
  indices: number[]; // indices into topology geometries
}

function getSigunNameKo(sido: string, firstName: string): string {
  if (METRO_CODES.has(sido)) {
    return SIDO_MAP[sido] || firstName;
  }
  if (firstName.includes(' ')) {
    return firstName.split(' ')[0]; // "수원시 장안구" → "수원시"
  }
  return firstName;
}

function getSigunNameEn(sido: string, code: string, nameKo: string): string {
  if (METRO_CODES.has(sido)) {
    return SIDO_MAP_EN[sido] || nameKo;
  }
  // For compound cities, derive from Korean name
  // Map known city names
  const cityNameMap: Record<string, string> = {
    '수원시': 'Suwon-si', '성남시': 'Seongnam-si', '안양시': 'Anyang-si',
    '안산시': 'Ansan-si', '고양시': 'Goyang-si', '용인시': 'Yongin-si',
    '청주시': 'Cheongju-si', '천안시': 'Cheonan-si', '전주시': 'Jeonju-si',
    '포항시': 'Pohang-si', '창원시': 'Changwon-si',
  };
  if (cityNameMap[nameKo]) return cityNameMap[nameKo];

  // Standalone: use SIGUNGU_NAMES_EN lookup
  return SIGUNGU_NAMES_EN[code] || SIDO_MAP_EN[code] || nameKo;
}

export function buildSigunData(
  topoData: Topology,
  geoData: RegionCollection,
): { geoData: RegionCollection; groups: SigunGroup[] } {
  const objectKey = Object.keys(topoData.objects)[0];
  const geometries = (topoData.objects[objectKey] as GeometryCollection).geometries;

  // Build groups
  const groupMap = new Map<string, SigunGroup>();

  geoData.features.forEach((f, i) => {
    const code = f.properties.SIG_CD || f.properties.CTPRVN_CD || f.properties.code || '';
    const name = f.properties.SIG_KOR_NM || f.properties.CTP_KOR_NM || f.properties.name || '';
    const sido = code.substring(0, 2);

    let groupKey: string;
    if (METRO_CODES.has(sido)) {
      groupKey = sido;
    } else if (name.includes(' ')) {
      groupKey = sido + ':' + name.split(' ')[0];
    } else {
      groupKey = code;
    }

    if (!groupMap.has(groupKey)) {
      const sigunName = getSigunNameKo(sido, name);
      groupMap.set(groupKey, {
        groupKey,
        code: METRO_CODES.has(sido) ? sido : (name.includes(' ') ? code.substring(0, 4) : code),
        nameKo: sigunName,
        nameEn: getSigunNameEn(sido, code, sigunName),
        indices: [],
      });
    }
    groupMap.get(groupKey)!.indices.push(i);
  });

  const groups = Array.from(groupMap.values());

  // Merge geometries for each group
  const features: RegionFeature[] = groups.map((group) => {
    const toMerge = group.indices.map((i) => geometries[i]);
    const merged = topojson.merge(topoData, toMerge as Parameters<typeof topojson.merge>[1]);

    // Remove holes (inner rings) from merged polygons — they're rivers/gaps between districts
    if (merged.type === 'MultiPolygon') {
      merged.coordinates = merged.coordinates.map((poly) => [poly[0]]);
    } else if (merged.type === 'Polygon') {
      merged.coordinates = [merged.coordinates[0]];
    }

    return {
      type: 'Feature' as const,
      geometry: merged,
      properties: {
        code: group.code,
        name: group.nameKo,
        SIG_CD: group.code,
        SIG_KOR_NM: group.nameKo,
        SIGUN_NAME_EN: group.nameEn,
      },
    } as RegionFeature;
  });

  return {
    geoData: { type: 'FeatureCollection', features },
    groups,
  };
}

// Get sigun count for UI
export function getSigunCount(geoData: RegionCollection): number {
  const groupKeys = new Set<string>();
  for (const f of geoData.features) {
    const code = f.properties.SIG_CD || f.properties.CTPRVN_CD || f.properties.code || '';
    const name = f.properties.SIG_KOR_NM || f.properties.CTP_KOR_NM || f.properties.name || '';
    const sido = code.substring(0, 2);

    if (METRO_CODES.has(sido)) {
      groupKeys.add(sido);
    } else if (name.includes(' ')) {
      groupKeys.add(sido + ':' + name.split(' ')[0]);
    } else {
      groupKeys.add(code);
    }
  }
  return groupKeys.size;
}

// Sigun English name lookup
export function getSigunNameEnByCode(code: string, nameKo: string): string {
  const sido = code.substring(0, 2);
  return getSigunNameEn(sido, code, nameKo);
}
