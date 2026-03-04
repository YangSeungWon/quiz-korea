import type { Feature, FeatureCollection, Polygon, MultiPolygon } from 'geojson';
import type { Topology } from 'topojson-specification';

export type { Locale } from '../i18n/types';

// Admin levels
export type AdminLevel = 'sido' | 'sigungu';

// Quiz modes matching Seterra
export type QuizMode = 'pin' | 'type' | 'pin-hard' | 'type-hard';

// Map display modes
export type MapDisplayMode = 'normal' | 'borderless' | 'outline-only';

// GeoJSON region types
export interface RegionProperties {
  code: string;
  name: string;
  CTPRVN_CD?: string;
  CTP_KOR_NM?: string;
  SIG_CD?: string;
  SIG_KOR_NM?: string;
  [key: string]: unknown;
}

export type RegionFeature = Feature<Polygon | MultiPolygon, RegionProperties>;
export type RegionCollection = FeatureCollection<Polygon | MultiPolygon, RegionProperties>;

// Region used in quiz engine
export interface QuizRegion {
  code: string;
  name: string;
  feature: RegionFeature;
}

// Quiz engine state
export type QuizPhase = 'ready' | 'playing' | 'finished';

export interface QuizState {
  phase: QuizPhase;
  queue: QuizRegion[];
  currentIndex: number;
  answered: Map<string, number>;
  currentWrongCount: number;
  wrongAttempts: number;
  totalRegions: number;
  wrongFlashCode: string | null;
}

export type QuizAction =
  | { type: 'START'; regions: QuizRegion[] }
  | { type: 'ANSWER_CORRECT' }
  | { type: 'ANSWER_WRONG' }
  | { type: 'CLEAR_FLASH' }
  | { type: 'RESET' };

// Map data from hook
export interface MapData {
  geoData: RegionCollection;
  topoData: Topology;
}

// Quiz config derived from URL
export interface QuizConfig {
  mode: QuizMode;
  adminLevel: AdminLevel;
  sidoFilter?: string;
}
