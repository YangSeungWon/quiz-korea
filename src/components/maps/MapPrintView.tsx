import { useMemo, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { geoCentroid } from 'd3-geo';
import type { GeoPermissibleObjects } from 'd3-geo';
import { useMapData } from '../../hooks/useMapData';
import { extractRegions, getSidoMeta, getRegionCode, getShortDisplayName } from '../../utils/regionUtils';
import { useI18n } from '../../i18n/useI18n';
import QuizMap from '../../maps/QuizMap';
import PrintInset from './PrintInset';
import type { AdminLevel, RegionFeature } from '../../types';

// A4 portrait at 96dpi = 794 × 1123 px (full bleed: margin 0 in page.pdf).
const PRINT_WIDTH = 794;
const PRINT_HEIGHT = 1123;

interface Box { x: number; y: number; w: number; h: number }
interface SheetLayout {
  sheet: { w: number; h: number };
  mapBox: Box;
  keyBox: Box | null;
}

// Layout descriptor derived from (variant, orientation). Portrait blank/label
// keeps the historical full-bleed map so existing output is unchanged. The
// number variant reserves a panel for the answer key; landscape is used mainly
// to host that key in the horizontal whitespace (Korea is portrait-shaped).
function computeLayout(isNumber: boolean, landscape: boolean): SheetLayout {
  const sheet = landscape ? { w: PRINT_HEIGHT, h: PRINT_WIDTH } : { w: PRINT_WIDTH, h: PRINT_HEIGHT };
  if (!isNumber) {
    if (!landscape) return { sheet, mapBox: { x: 0, y: 0, w: PRINT_WIDTH, h: PRINT_HEIGHT }, keyBox: null };
    // Center a portrait-proportioned map on the landscape sheet so the outlier
    // insets stay next to the coastline instead of drifting into empty margin.
    const w = 640;
    return { sheet, mapBox: { x: Math.round((sheet.w - w) / 2), y: 0, w, h: sheet.h }, keyBox: null };
  }
  if (!landscape) {
    return { sheet, mapBox: { x: 0, y: 0, w: PRINT_WIDTH, h: 760 }, keyBox: { x: 12, y: 768, w: 770, h: 343 } };
  }
  return { sheet, mapBox: { x: 0, y: 0, w: 600, h: sheet.h }, keyBox: { x: 612, y: 40, w: 495, h: 714 } };
}

// Adaptive answer-key sizing: pick the largest font in the ladder whose columns
// fit keyBox for N entries. 7px floor is the safety net for the densest case
// (national 시군 ~150 in portrait). Never needs a second page.
function computeKeyStyle(n: number, keyBox: Box, maxChars: number) {
  for (const fontSize of [12, 11, 10, 9, 8, 7]) {
    const rowH = fontSize + 4;
    const rowsPerCol = Math.max(1, Math.floor((keyBox.h - 20) / rowH));
    const cols = Math.max(1, Math.ceil(n / rowsPerCol));
    const colW = keyBox.w / cols;
    const needW = 24 + maxChars * fontSize * 0.6; // number gutter + text estimate
    if (colW >= needW) return { fontSize, cols, rowH };
  }
  const fontSize = 7;
  const rowH = fontSize + 4;
  const rowsPerCol = Math.max(1, Math.floor((keyBox.h - 20) / rowH));
  return { fontSize, cols: Math.max(1, Math.ceil(n / rowsPerCol)), rowH };
}

// Outlier sigungu codes — pulled out of the main map and rendered in dedicated
// inset boxes so the mainland doesn't get squished by their distant bbox.
// 신안군 (46910)은 outlier로 분류하지 않고 본토와 함께 그림 — 살짝만 서쪽으로 튀어남.
const OUTLIER_DONGHAE = ['37630']; // 경북 울릉군 (울릉도/독도)
const OUTLIER_SEOHAE = ['23520']; // 인천 옹진군 (백령도/대청도/연평도)

// Density-zone bbox는 메인 서비스(QuizMap.tsx INSET_ZONES)와 동일하게 좁게 잡음.
// centroid가 bbox 안에 있는 sigungu만 inset으로 넘기고, 외곽(경기 양평·포천 등)은 본 지도에 둠.
const SUGOKWON_BBOX: readonly [number, number, number, number] = [126.46, 37.22, 127.25, 37.75];
const DAEGU_BBOX: readonly [number, number, number, number] = [128.47, 35.77, 128.73, 35.99];
const BUSAN_BBOX: readonly [number, number, number, number] = [128.96, 35.05, 129.21, 35.28];

// Default outlier inset sizes (full-country view)
const INSET_W = 150;
const INSET_H = 110;
// When filtered to the sido that owns the outlier (e.g. /maps/sigungu/incheon),
// the outlier represents a meaningful fraction of the sido — bump the inset up
// so it gets visual weight similar to the mainland portion.
const FILTERED_OUTLIER_W = 280;
const FILTERED_OUTLIER_H = 210;
const SUGOKWON_W = 200;
const SUGOKWON_H = 200;
const METRO_INSET_W = 150;
const METRO_INSET_H = 130;

function inBbox(centroid: [number, number], bbox: readonly [number, number, number, number]): boolean {
  const [lon, lat] = centroid;
  return lon >= bbox[0] && lon <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];
}

interface PartitionedFeatures {
  main: RegionFeature[];
  donghae: RegionFeature[];
  seohae: RegionFeature[];
  sugokwon: RegionFeature[];
  daegu: RegionFeature[];
  busan: RegionFeature[];
}

function partitionOutliers(
  features: RegionFeature[],
  adminLevel: AdminLevel,
  hasSidoFilter: boolean,
): PartitionedFeatures {
  // sido: whole-country, no insets. dong: single 시군구, no insets (and dong
  // codes would falsely match the 5-digit outlier prefixes, so must bypass).
  if (adminLevel === 'sido' || adminLevel === 'dong') {
    return { main: features, donghae: [], seohae: [], sugokwon: [], daegu: [], busan: [] };
  }
  const main: RegionFeature[] = [];
  const donghae: RegionFeature[] = [];
  const seohae: RegionFeature[] = [];
  const sugokwon: RegionFeature[] = [];
  const daegu: RegionFeature[] = [];
  const busan: RegionFeature[] = [];
  // Full-country views only. 수도권 확대 applies at both 시군구 and 시군 (the 경기
  // 수도권 시들이 서울 주변에 빽빽해 라벨이 뭉개짐). 대구/부산 확대는 시군구 전용 —
  // 시군 레벨에선 대구·부산이 단일 병합 단위라 확대할 내부 구가 없음.
  const applySugokwon = (adminLevel === 'sigungu' || adminLevel === 'sigun') && !hasSidoFilter;
  const applyMetroZoom = adminLevel === 'sigungu' && !hasSidoFilter;
  for (const f of features) {
    const code = f.properties.SIG_CD || f.properties.CTPRVN_CD || f.properties.code || '';
    if (OUTLIER_DONGHAE.some((c) => code.startsWith(c))) {
      donghae.push(f);
      continue;
    }
    if (OUTLIER_SEOHAE.some((c) => code.startsWith(c))) {
      seohae.push(f);
      continue;
    }
    main.push(f);
    if (!applySugokwon) continue;
    const c = geoCentroid(f as GeoPermissibleObjects);
    if (!Number.isFinite(c[0]) || !Number.isFinite(c[1])) continue;
    if (inBbox(c, SUGOKWON_BBOX)) sugokwon.push(f);
    else if (applyMetroZoom && inBbox(c, DAEGU_BBOX)) daegu.push(f);
    else if (applyMetroZoom && inBbox(c, BUSAN_BBOX)) busan.push(f);
  }
  return { main, donghae, seohae, sugokwon, daegu, busan };
}

/**
 * Print-only view consumed by puppeteer at build time to generate PDFs.
 * Not in the sitemap; marked noindex via <meta>.
 */
export default function MapPrintView() {
  const { variant, level: levelParam, sidoSlug } = useParams<{
    variant: string;
    level: string;
    sidoSlug?: string;
  }>();
  const [searchParams] = useSearchParams();
  const { locale, t } = useI18n();
  const adminLevel = (levelParam || 'sido') as AdminLevel;
  const isDong = adminLevel === 'dong';
  const sidoMeta = getSidoMeta(sidoSlug || '');
  // 동: the :sidoSlug segment carries the raw 5-digit 시군구 code (no slug).
  const filterCode = isDong ? (sidoSlug || undefined) : sidoMeta?.code;
  const isNumber = variant === 'number';
  const showLabels = variant === 'label';
  const monochrome = searchParams.get('bw') === '1';
  const landscape = searchParams.get('orient') === 'landscape';
  const { sheet, mapBox, keyBox } = computeLayout(isNumber, landscape);

  const { geoData, topoData, borderMesh, loading, error } = useMapData(adminLevel, filterCode);

  const filteredGeoData = useMemo(() => {
    if (!geoData || !filterCode) return geoData;
    return {
      ...geoData,
      features: geoData.features.filter((f) => {
        const code = f.properties.SIG_CD || f.properties.CTPRVN_CD || f.properties.code || '';
        return code.startsWith(filterCode);
      }),
    };
  }, [geoData, filterCode]);

  const partitioned = useMemo(
    () =>
      filteredGeoData
        ? partitionOutliers(filteredGeoData.features, adminLevel, !!sidoMeta)
        : null,
    [filteredGeoData, adminLevel, sidoMeta],
  );

  const mainGeoData = useMemo(() => {
    if (!filteredGeoData || !partitioned) return filteredGeoData;
    return { ...filteredGeoData, features: partitioned.main };
  }, [filteredGeoData, partitioned]);

  // 번호형: number every region once, in region-code order (deterministic,
  // locale-independent, and groups sido→sigungu). The SAME map drives on-map
  // numbers (main + insets) and the answer-key list so they never desync.
  const { numbering, keyEntries } = useMemo(() => {
    if (!isNumber || !filteredGeoData) {
      return { numbering: undefined as Map<string, number> | undefined, keyEntries: [] as { num: number; name: string }[] };
    }
    const ordered = [...filteredGeoData.features].sort((a, b) =>
      getRegionCode(a).localeCompare(getRegionCode(b)),
    );
    const map = new Map<string, number>();
    const entries: { num: number; name: string }[] = [];
    ordered.forEach((f, i) => {
      const num = i + 1;
      map.set(getRegionCode(f), num);
      entries.push({ num, name: getShortDisplayName(f, locale) });
    });
    return { numbering: map, keyEntries: entries };
  }, [isNumber, filteredGeoData, locale]);

  // Codes inside any density inset → skip labels in main map (labels live in inset).
  const insetSkipCodes = useMemo(() => {
    if (!partitioned) return undefined;
    const all = [...partitioned.sugokwon, ...partitioned.daegu, ...partitioned.busan];
    if (all.length === 0) return undefined;
    const set = new Set<string>();
    for (const f of all) {
      const c = f.properties.SIG_CD || f.properties.CTPRVN_CD || f.properties.code || '';
      if (c) set.add(c);
    }
    return set;
  }, [partitioned]);

  // Dashed bbox markers on main map for each non-empty density inset
  const printBboxMarkers = useMemo(() => {
    if (!partitioned) return undefined;
    const markers: { bbox: readonly [number, number, number, number]; color?: string }[] = [];
    if (partitioned.sugokwon.length > 0) markers.push({ bbox: SUGOKWON_BBOX, color: '#6b7280' });
    if (partitioned.daegu.length > 0) markers.push({ bbox: DAEGU_BBOX, color: '#6b7280' });
    if (partitioned.busan.length > 0) markers.push({ bbox: BUSAN_BBOX, color: '#6b7280' });
    return markers.length > 0 ? markers : undefined;
  }, [partitioned]);

  const emptyAnswered = useMemo(() => new Map<string, number>(), []);

  // Mark this page noindex — these are puppeteer-internal routes
  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'robots');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'noindex,nofollow');
    const styleEl = document.createElement('style');
    styleEl.id = 'print-view-reset';
    styleEl.textContent = `
      @page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 0; }
      @keyframes print-view-spin { to { transform: rotate(360deg); } }
      /* On screen: show the A4 sheet centered on a gray "desk" like a preview. */
      @media screen {
        html, body { margin: 0 !important; padding: 0 !important; background: #4b5563 !important; }
        #root {
          display: flex !important;
          justify-content: center !important;
          align-items: flex-start !important;
          min-height: 100vh !important;
          padding: 24px !important;
          box-sizing: border-box !important;
        }
        [data-print-ready], [data-print-status] { box-shadow: 0 6px 30px rgba(0,0,0,0.4) !important; }
      }
      /* In print/PDF (puppeteer page.pdf uses print media): full-bleed sheet. */
      @media print {
        html, body { margin: 0 !important; padding: 0 !important; background: #ffffff !important; overflow: hidden !important; width: ${sheet.w}px !important; height: ${sheet.h}px !important; }
        #root { margin: 0 !important; padding: 0 !important; width: ${sheet.w}px !important; height: ${sheet.h}px !important; overflow: hidden !important; }
      }
    `;
    document.head.appendChild(styleEl);
    return () => {
      styleEl.remove();
    };
  }, [landscape, sheet.w, sheet.h]);

  useMemo(
    () => (filteredGeoData ? extractRegions(filteredGeoData, sidoMeta?.code, locale) : []),
    [filteredGeoData, sidoMeta, locale],
  );

  if (loading || !mainGeoData || !topoData || error) {
    return (
      <div
        data-print-status={error ? 'error' : 'loading'}
        style={{
          width: sheet.w,
          height: sheet.h,
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          fontFamily: 'system-ui, sans-serif',
          color: error ? '#dc2626' : '#6b7280',
        }}
      >
        {!error && (
          <div
            style={{
              width: 40,
              height: 40,
              border: '3px solid #e5e7eb',
              borderTopColor: '#2563eb',
              borderRadius: '50%',
              animation: 'print-view-spin 0.8s linear infinite',
            }}
          />
        )}
        <div style={{ fontSize: 15, fontWeight: 500 }}>
          {error
            ? (locale === 'en' ? 'Failed to load the map.' : '지도를 불러오지 못했습니다.')
            : (locale === 'en' ? 'Preparing the map…' : '지도 준비 중…')}
        </div>
      </div>
    );
  }

  return (
    <div
      data-print-ready="true"
      style={{
        width: sheet.w,
        height: sheet.h,
        background: '#ffffff',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Map region — positioned box so number/landscape layouts can reserve
          space for the answer key without the map overflowing the sheet. */}
      <div style={{ position: 'absolute', left: mapBox.x, top: mapBox.y, width: mapBox.w, height: mapBox.h }}>
        <QuizMap
          geoData={mainGeoData}
          contextGeoData={sidoMeta ? geoData : null}
          topoData={topoData}
          borderMesh={sidoMeta ? null : borderMesh}
          displayMode="normal"
          width={mapBox.w}
          height={mapBox.h}
          showInsets={false}
          adminLevel={adminLevel}
          locale={locale}
          answeredCodes={emptyAnswered}
          wrongFlashCode={null}
          monochrome={monochrome}
          staticLabels={showLabels || isNumber}
          staticLabelMode={isNumber ? 'number' : 'name'}
          staticLabelNumbers={numbering}
          staticLabelSkipCodes={(showLabels || isNumber) ? insetSkipCodes : undefined}
          staticLabelCompact={adminLevel === 'sigun' || adminLevel === 'sido'}
          staticLabelFontRange={(!isNumber && (sidoMeta || isDong)) ? [11, 18] : undefined}
          printBboxMarkers={printBboxMarkers}
        />
      </div>

      {/* Outlier insets — layered absolute on top of the main map, positioned
          relative to mapBox so they follow the map in landscape/number layouts. */}
      {partitioned && (() => {
        const seohaeBig = sidoMeta?.code === '23';   // /maps/.../incheon
        const donghaeBig = sidoMeta?.code === '37';  // /maps/.../gyeongbuk
        const seohaeW = seohaeBig ? FILTERED_OUTLIER_W : INSET_W;
        const seohaeH = seohaeBig ? FILTERED_OUTLIER_H : INSET_H;
        const donghaeW = donghaeBig ? FILTERED_OUTLIER_W : INSET_W;
        const donghaeH = donghaeBig ? FILTERED_OUTLIER_H : INSET_H;
        const insetMode = isNumber ? ('number' as const) : ('name' as const);
        const left = mapBox.x;
        const top = mapBox.y;
        return (
        <>
          <PrintInset
            features={partitioned.seohae}
            label={locale === 'en' ? 'West Sea Islands' : '서해 5도'}
            showLabels={showLabels}
            mode={insetMode}
            numbers={numbering}
            monochrome={monochrome}
            locale={locale}
            x={left + 12}
            y={top + 12}
            width={seohaeW}
            height={seohaeH}
            compact={adminLevel === 'sigun'}
            fontRange={seohaeBig ? [11, 17] : undefined}
          />
          <PrintInset
            features={partitioned.donghae}
            label={locale === 'en' ? 'East Sea (Ulleung/Dokdo)' : '동해 (울릉도/독도)'}
            showLabels={showLabels}
            mode={insetMode}
            numbers={numbering}
            monochrome={monochrome}
            locale={locale}
            x={left + mapBox.w - donghaeW - 12}
            y={top + 12}
            width={donghaeW}
            height={donghaeH}
            compact={adminLevel === 'sigun'}
            fontRange={donghaeBig ? [11, 17] : undefined}
          />
          <PrintInset
            features={partitioned.sugokwon}
            label={locale === 'en' ? 'Capital Region (zoom)' : '수도권 확대'}
            showLabels={showLabels}
            mode={insetMode}
            numbers={numbering}
            monochrome={monochrome}
            locale={locale}
            x={left + 12}
            y={top + 12 + INSET_H + 16}
            width={SUGOKWON_W}
            height={SUGOKWON_H}
            bbox={SUGOKWON_BBOX}
            compact={adminLevel === 'sigun'}
          />
          <PrintInset
            features={partitioned.daegu}
            label={locale === 'en' ? 'Daegu (zoom)' : '대구 확대'}
            showLabels={showLabels}
            mode={insetMode}
            numbers={numbering}
            monochrome={monochrome}
            locale={locale}
            x={left + 12}
            y={top + 12 + INSET_H + 16 + SUGOKWON_H + 16}
            width={METRO_INSET_W}
            height={METRO_INSET_H}
            bbox={DAEGU_BBOX}
          />
          <PrintInset
            features={partitioned.busan}
            label={locale === 'en' ? 'Busan (zoom)' : '부산 확대'}
            showLabels={showLabels}
            mode={insetMode}
            numbers={numbering}
            monochrome={monochrome}
            locale={locale}
            x={left + 12}
            y={top + 12 + INSET_H + 16 + SUGOKWON_H + 16 + METRO_INSET_H + 16}
            width={METRO_INSET_W}
            height={METRO_INSET_H}
            bbox={BUSAN_BBOX}
          />
        </>
        );
      })()}

      {/* 번호형 answer key — DOM panel at keyBox, adaptive multi-column list. */}
      {isNumber && keyBox && keyEntries.length > 0 && (() => {
        const maxChars = keyEntries.reduce((m, e) => Math.max(m, `${e.num}. ${e.name}`.length), 0);
        const { fontSize, cols, rowH } = computeKeyStyle(keyEntries.length, keyBox, maxChars);
        return (
          <div
            style={{
              position: 'absolute',
              left: keyBox.x,
              top: keyBox.y,
              width: keyBox.w,
              height: keyBox.h,
              fontFamily: 'system-ui, sans-serif',
              color: '#111827',
              overflow: 'hidden',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
              {t('maps.answerKeyTitle')}
            </div>
            <div style={{ columnCount: cols, columnGap: 10, fontSize, lineHeight: `${rowH}px` }}>
              {keyEntries.map((e) => (
                <div key={e.num} style={{ breakInside: 'avoid', whiteSpace: 'nowrap' }}>
                  {e.num}. {e.name}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Watermark — bottom right */}
      <div
        style={{
          position: 'absolute',
          bottom: 8,
          right: 12,
          fontSize: 11,
          color: '#9ca3af',
          fontFamily: 'system-ui, sans-serif',
          letterSpacing: '0.02em',
          pointerEvents: 'none',
        }}
      >
        quiz-korea.ysw.kr
      </div>

      {/* On-screen print button for human visitors. Hidden in print/PDF
          output (.no-print), so puppeteer's page.pdf() never includes it. */}
      <button
        type="button"
        onClick={() => window.print()}
        className="no-print"
        style={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          zIndex: 50,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 16px',
          borderRadius: 9999,
          border: 'none',
          background: '#2563eb',
          color: '#fff',
          fontFamily: 'system-ui, sans-serif',
          fontSize: 14,
          fontWeight: 600,
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          cursor: 'pointer',
        }}
      >
        🖨 {locale === 'en' ? 'Print' : '인쇄'}
      </button>
    </div>
  );
}
