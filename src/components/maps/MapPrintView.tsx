import { useMemo, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { geoCentroid, geoBounds } from 'd3-geo';
import type { GeoPermissibleObjects } from 'd3-geo';
import { useMapData } from '../../hooks/useMapData';
import { extractRegions, getSidoMeta, getRegionCode, getShortDisplayName } from '../../utils/regionUtils';
import { useI18n } from '../../i18n/useI18n';
import QuizMap from '../../maps/QuizMap';
import PrintInset from './PrintInset';
import { PrinterIcon } from '../icons';
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
function computeLayout(isNumber: boolean, landscape: boolean, keyN = 0, keyMaxChars = 0): SheetLayout {
  const sheet = landscape ? { w: PRINT_HEIGHT, h: PRINT_WIDTH } : { w: PRINT_WIDTH, h: PRINT_HEIGHT };
  if (!isNumber) {
    // Map fills the whole sheet in both orientations. Wide filtered regions (충북)
    // then fill a landscape sheet; national Korea (tall) centers, leaving the side
    // corners empty for the outlier insets (no more covering 강원 in landscape).
    return { sheet, mapBox: { x: 0, y: 0, w: sheet.w, h: sheet.h }, keyBox: null };
  }
  // Number: size the answer-key band to its content so a short list doesn't steal
  // map space. Portrait key sits at the bottom (pack wide → few rows → taller map).
  const fontSize = 11;
  const rowH = fontSize + 4;
  const heading = 22;
  const n = Math.max(1, keyN);
  const colW = 24 + keyMaxChars * fontSize * 0.6 + KEY_COL_GAP;
  if (!landscape) {
    const maxCols = Math.max(1, Math.floor((PRINT_WIDTH - 24) / colW));
    const cols = Math.min(maxCols, n);
    const rows = Math.ceil(n / cols);
    const keyH = Math.min(Math.round(PRINT_HEIGHT * 0.42), heading + rows * rowH + 12);
    const mapH = PRINT_HEIGHT - keyH - 8;
    return { sheet, mapBox: { x: 0, y: 0, w: PRINT_WIDTH, h: mapH }, keyBox: { x: 12, y: mapH + 4, w: PRINT_WIDTH - 24, h: keyH } };
  }
  // Landscape key sits on the right; keep a min width for the inset row that stacks
  // above it, but still shrink toward the content for short lists.
  const rowsPerCol = Math.max(1, Math.floor((sheet.h - 52 - heading) / rowH));
  const cols = Math.max(1, Math.ceil(n / rowsPerCol));
  const keyW = Math.max(370, Math.min(Math.round(sheet.w * 0.5), cols * colW));
  const mapW = sheet.w - keyW - 24;
  return { sheet, mapBox: { x: 0, y: 0, w: mapW, h: sheet.h }, keyBox: { x: mapW + 12, y: 40, w: keyW, h: sheet.h - 52 } };
}

// Adaptive answer-key sizing: pick the largest font in the ladder whose columns
// fit keyBox for N entries. Also returns the *packed* width (cols × column width)
// so a short list occupies a narrow block instead of stretching across keyBox.
// 7px floor is the safety net for the densest case (national 시군 ~150 portrait).
const KEY_COL_GAP = 10;
function computeKeyStyle(n: number, keyBox: Box, maxChars: number) {
  const colUnit = (fontSize: number) => 24 + maxChars * fontSize * 0.6 + KEY_COL_GAP;
  // Rebalance so the grid has no near-empty trailing column: once the row count
  // is fixed, spread entries evenly (8 items → 4×2, not 7+1).
  const pick = (fontSize: number) => {
    const rowH = fontSize + 4;
    const rowsPerCol = Math.max(1, Math.floor((keyBox.h - 20) / rowH));
    const maxCols = Math.max(1, Math.min(Math.floor(keyBox.w / (colUnit(fontSize) - KEY_COL_GAP)), Math.ceil(n / 1)));
    const cols0 = Math.max(1, Math.ceil(n / rowsPerCol));
    if (cols0 > maxCols) return null; // doesn't fit this font
    const rows = Math.ceil(n / cols0);
    const cols = Math.ceil(n / rows); // even columns for `rows` rows
    return { fontSize, cols, rowH, width: Math.min(keyBox.w, Math.ceil(cols * colUnit(fontSize))) };
  };
  for (const fontSize of [12, 11, 10, 9, 8, 7]) {
    const r = pick(fontSize);
    if (r) return r;
  }
  // Floor: accept 7px even if tight.
  const fontSize = 7;
  const rowH = fontSize + 4;
  const rowsPerCol = Math.max(1, Math.floor((keyBox.h - 20) / rowH));
  const cols0 = Math.max(1, Math.ceil(n / rowsPerCol));
  const rows = Math.ceil(n / cols0);
  const cols = Math.ceil(n / rows);
  return { fontSize, cols, rowH, width: Math.min(keyBox.w, Math.ceil(cols * colUnit(fontSize))) };
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
const SUGOKWON_W = 250;
const SUGOKWON_H = 250;
const METRO_INSET_W = 150;
const METRO_INSET_H = 130;

function inBbox(centroid: [number, number], bbox: readonly [number, number, number, number]): boolean {
  const [lon, lat] = centroid;
  return lon >= bbox[0] && lon <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];
}

function featureOverlapsBbox(feature: RegionFeature, bbox: readonly [number, number, number, number]): boolean {
  const [[fMinLon, fMinLat], [fMaxLon, fMaxLat]] = geoBounds(feature as GeoPermissibleObjects);
  return fMaxLon >= bbox[0] && fMinLon <= bbox[2] && fMaxLat >= bbox[1] && fMinLat <= bbox[3];
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

  // Layout depends on the answer-key size so a short list gives the map more room.
  const keyMaxChars = keyEntries.reduce((m, e) => Math.max(m, `${e.num}. ${e.name}`.length), 0);
  const { sheet, mapBox, keyBox } = computeLayout(isNumber, landscape, keyEntries.length, keyMaxChars);

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

  // ---- Inset placement ----
  // Portrait & landscape blank/label: layered over the full-sheet map's empty
  // corners (Korea centers in landscape, so corners are sea). Number landscape:
  // the map is narrow (key on the right), so insets sit in a row atop the key
  // column and push the key down instead of covering the map.
  const insetMode = isNumber ? ('number' as const) : ('name' as const);
  const seohaeBig = sidoMeta?.code === '23';
  const donghaeBig = sidoMeta?.code === '37';
  // Neighbors straddling a density bbox: rendered (clipped) in the zoom for
  // geographic context, but labeled on the main map (their centroid is outside).
  const contextFor = (bbox: readonly [number, number, number, number], own: RegionFeature[]) => {
    if (!mainGeoData) return [] as RegionFeature[];
    const ownCodes = new Set(own.map((f) => getRegionCode(f)));
    return mainGeoData.features.filter((f) => !ownCodes.has(getRegionCode(f)) && featureOverlapsBbox(f, bbox));
  };
  // 인천 straddles the 수도권 bbox (centroid west of it), so it isn't in the
  // centroid-partitioned zone. At 시군 level add it to the zoom's own (drawn +
  // labeled, position clamped inside), while keeping it labeled on the main map.
  const sugokwonOwn = partitioned
    ? [...partitioned.sugokwon, ...(adminLevel === 'sigun' ? (mainGeoData?.features.filter((f) => getRegionCode(f) === '23') ?? []) : [])]
    : [];
  const insetDefs = partitioned
    ? ([
        { features: partitioned.seohae, contextFeatures: undefined as RegionFeature[] | undefined, label: locale === 'en' ? 'West Sea Islands' : '서해 5도', w: seohaeBig ? FILTERED_OUTLIER_W : INSET_W, h: seohaeBig ? FILTERED_OUTLIER_H : INSET_H, fontRange: seohaeBig ? ([11, 17] as [number, number]) : undefined, bbox: undefined as (readonly [number, number, number, number] | undefined) },
        { features: partitioned.donghae, contextFeatures: undefined, label: locale === 'en' ? 'East Sea (Ulleung/Dokdo)' : '동해 (울릉도/독도)', w: donghaeBig ? FILTERED_OUTLIER_W : INSET_W, h: donghaeBig ? FILTERED_OUTLIER_H : INSET_H, fontRange: donghaeBig ? ([11, 17] as [number, number]) : undefined, bbox: undefined },
        { features: sugokwonOwn, contextFeatures: contextFor(SUGOKWON_BBOX, sugokwonOwn), label: locale === 'en' ? 'Capital Region (zoom)' : '수도권 확대', w: SUGOKWON_W, h: SUGOKWON_H, fontRange: undefined, bbox: SUGOKWON_BBOX },
        { features: partitioned.daegu, contextFeatures: contextFor(DAEGU_BBOX, partitioned.daegu), label: locale === 'en' ? 'Daegu (zoom)' : '대구 확대', w: METRO_INSET_W, h: METRO_INSET_H, fontRange: undefined, bbox: DAEGU_BBOX },
        { features: partitioned.busan, contextFeatures: contextFor(BUSAN_BBOX, partitioned.busan), label: locale === 'en' ? 'Busan (zoom)' : '부산 확대', w: METRO_INSET_W, h: METRO_INSET_H, fontRange: undefined, bbox: BUSAN_BBOX },
      ].filter((d) => d.features.length > 0))
    : [];

  let effKeyBox = keyBox;
  const placedInsets = insetDefs.map((d, i) => ({ ...d, x: 0, y: 0, idx: i }));
  if (isNumber && landscape && keyBox) {
    // Row across the top of the key column; push the key below the tallest inset.
    let x = keyBox.x;
    let rowH = 0;
    for (const p of placedInsets) { p.x = x; p.y = keyBox.y; x += p.w + 10; rowH = Math.max(rowH, p.h); }
    if (rowH > 0) effKeyBox = { ...keyBox, y: keyBox.y + rowH + 12, h: keyBox.h - rowH - 12 };
  } else {
    // Corner layout: 동해 top-right, everything else stacked down the left. For
    // filtered 경북 (donghaeBig) the map fills the sheet and its NE tip (울진) is
    // at top-right, so drop the (enlarged) 동해 inset to the empty bottom-right.
    let leftY = mapBox.y + 12;
    for (const p of placedInsets) {
      const isDonghae = p.label.includes('동해') || p.label.includes('East Sea');
      if (isDonghae) {
        p.x = mapBox.x + mapBox.w - p.w - 12;
        p.y = donghaeBig ? (mapBox.y + mapBox.h - p.h - 12) : (mapBox.y + 12);
      } else {
        p.x = mapBox.x + 12;
        p.y = leftY;
        leftY += p.h + 16;
      }
    }
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

      {/* Outlier / density insets — positions computed above (corner-over-map,
          or a row atop the key column for number-landscape). */}
      {placedInsets.map((p) => (
        <PrintInset
          key={p.idx}
          features={p.features}
          label={p.label}
          showLabels={showLabels}
          mode={insetMode}
          numbers={numbering}
          monochrome={monochrome}
          locale={locale}
          x={p.x}
          y={p.y}
          width={p.w}
          height={p.h}
          bbox={p.bbox}
          contextFeatures={p.contextFeatures}
          compact={adminLevel === 'sigun'}
          fontRange={p.fontRange}
        />
      ))}

      {/* 번호형 answer key — DOM panel at effKeyBox, adaptive multi-column list. */}
      {isNumber && effKeyBox && keyEntries.length > 0 && (() => {
        const maxChars = keyEntries.reduce((m, e) => Math.max(m, `${e.num}. ${e.name}`.length), 0);
        const { fontSize, cols, rowH, width: keyW } = computeKeyStyle(keyEntries.length, effKeyBox, maxChars);
        return (
          <div
            style={{
              position: 'absolute',
              left: effKeyBox.x,
              top: effKeyBox.y,
              width: effKeyBox.w,
              height: effKeyBox.h,
              fontFamily: 'system-ui, sans-serif',
              color: '#111827',
              overflow: 'hidden',
            }}
          >
            {/* Centered block sized to its content so short lists don't leave a
                big gap on one side. */}
            <div style={{ width: keyW, margin: '0 auto' }}>
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
        <PrinterIcon size={16} /> {locale === 'en' ? 'Print' : '인쇄'}
      </button>
    </div>
  );
}
