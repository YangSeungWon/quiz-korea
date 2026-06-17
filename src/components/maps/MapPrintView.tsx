import { useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { geoCentroid } from 'd3-geo';
import type { GeoPermissibleObjects } from 'd3-geo';
import { useMapData } from '../../hooks/useMapData';
import { extractRegions, getSidoMeta } from '../../utils/regionUtils';
import { useI18n } from '../../i18n/useI18n';
import QuizMap from '../../maps/QuizMap';
import PrintInset from './PrintInset';
import type { AdminLevel, RegionFeature } from '../../types';

// A4 portrait at 96dpi = 794 × 1123 px (full bleed: margin 0 in page.pdf).
const PRINT_WIDTH = 794;
const PRINT_HEIGHT = 1123;

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
  if (adminLevel === 'sido') {
    return { main: features, donghae: [], seohae: [], sugokwon: [], daegu: [], busan: [] };
  }
  const main: RegionFeature[] = [];
  const donghae: RegionFeature[] = [];
  const seohae: RegionFeature[] = [];
  const sugokwon: RegionFeature[] = [];
  const daegu: RegionFeature[] = [];
  const busan: RegionFeature[] = [];
  // Density insets only at sigungu level for full-country views.
  // sigun level metros are already merged → no zoom needed.
  const applyDensityInsets = adminLevel === 'sigungu' && !hasSidoFilter;
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
    if (!applyDensityInsets) continue;
    const c = geoCentroid(f as GeoPermissibleObjects);
    if (!Number.isFinite(c[0]) || !Number.isFinite(c[1])) continue;
    if (inBbox(c, SUGOKWON_BBOX)) sugokwon.push(f);
    else if (inBbox(c, DAEGU_BBOX)) daegu.push(f);
    else if (inBbox(c, BUSAN_BBOX)) busan.push(f);
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
  const { locale } = useI18n();
  const adminLevel = (levelParam || 'sido') as AdminLevel;
  const sidoMeta = getSidoMeta(sidoSlug || '');
  const showLabels = variant === 'label';

  const { geoData, topoData, borderMesh, loading, error } = useMapData(adminLevel);

  const filteredGeoData = useMemo(() => {
    if (!geoData || !sidoMeta) return geoData;
    return {
      ...geoData,
      features: geoData.features.filter((f) => {
        const code = f.properties.SIG_CD || f.properties.CTPRVN_CD || f.properties.code || '';
        return code.startsWith(sidoMeta.code);
      }),
    };
  }, [geoData, sidoMeta]);

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
      @page { size: A4 portrait; margin: 0; }
      html, body { margin: 0 !important; padding: 0 !important; background: #ffffff !important; overflow: hidden !important; width: ${PRINT_WIDTH}px !important; height: ${PRINT_HEIGHT}px !important; }
      #root { margin: 0 !important; padding: 0 !important; width: ${PRINT_WIDTH}px !important; height: ${PRINT_HEIGHT}px !important; overflow: hidden !important; }
    `;
    document.head.appendChild(styleEl);
    return () => {
      styleEl.remove();
    };
  }, []);

  useMemo(
    () => (filteredGeoData ? extractRegions(filteredGeoData, sidoMeta?.code, locale) : []),
    [filteredGeoData, sidoMeta, locale],
  );

  if (loading || !mainGeoData || !topoData || error) {
    return <div data-print-status="loading">Loading...</div>;
  }

  return (
    <div
      data-print-ready="true"
      style={{
        width: PRINT_WIDTH,
        height: PRINT_HEIGHT,
        background: '#ffffff',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <QuizMap
        geoData={mainGeoData}
        contextGeoData={sidoMeta ? geoData : null}
        topoData={topoData}
        borderMesh={sidoMeta ? null : borderMesh}
        displayMode="normal"
        width={PRINT_WIDTH}
        height={PRINT_HEIGHT}
        showInsets={false}
        adminLevel={adminLevel}
        locale={locale}
        answeredCodes={emptyAnswered}
        wrongFlashCode={null}
        staticLabels={showLabels}
        staticLabelSkipCodes={showLabels ? insetSkipCodes : undefined}
        staticLabelCompact={adminLevel === 'sigun'}
        staticLabelFontRange={sidoMeta ? [9, 14] : undefined}
        printBboxMarkers={printBboxMarkers}
      />

      {/* Outlier insets — layered absolute on top of the main map */}
      {partitioned && (() => {
        const seohaeBig = sidoMeta?.code === '23';   // /maps/.../incheon
        const donghaeBig = sidoMeta?.code === '37';  // /maps/.../gyeongbuk
        const seohaeW = seohaeBig ? FILTERED_OUTLIER_W : INSET_W;
        const seohaeH = seohaeBig ? FILTERED_OUTLIER_H : INSET_H;
        const donghaeW = donghaeBig ? FILTERED_OUTLIER_W : INSET_W;
        const donghaeH = donghaeBig ? FILTERED_OUTLIER_H : INSET_H;
        return (
        <>
          <PrintInset
            features={partitioned.seohae}
            label={locale === 'en' ? 'West Sea Islands' : '서해 5도'}
            showLabels={showLabels}
            locale={locale}
            x={12}
            y={12}
            width={seohaeW}
            height={seohaeH}
            compact={adminLevel === 'sigun'}
            fontRange={seohaeBig ? [9, 14] : undefined}
          />
          <PrintInset
            features={partitioned.donghae}
            label={locale === 'en' ? 'East Sea (Ulleung/Dokdo)' : '동해 (울릉도/독도)'}
            showLabels={showLabels}
            locale={locale}
            x={PRINT_WIDTH - donghaeW - 12}
            y={12}
            width={donghaeW}
            height={donghaeH}
            compact={adminLevel === 'sigun'}
            fontRange={donghaeBig ? [9, 14] : undefined}
          />
          <PrintInset
            features={partitioned.sugokwon}
            label={locale === 'en' ? 'Capital Region (zoom)' : '수도권 확대'}
            showLabels={showLabels}
            locale={locale}
            x={12}
            y={12 + INSET_H + 16}
            width={SUGOKWON_W}
            height={SUGOKWON_H}
            bbox={SUGOKWON_BBOX}
          />
          <PrintInset
            features={partitioned.daegu}
            label={locale === 'en' ? 'Daegu (zoom)' : '대구 확대'}
            showLabels={showLabels}
            locale={locale}
            x={12}
            y={12 + INSET_H + 16 + SUGOKWON_H + 16}
            width={METRO_INSET_W}
            height={METRO_INSET_H}
            bbox={DAEGU_BBOX}
          />
          <PrintInset
            features={partitioned.busan}
            label={locale === 'en' ? 'Busan (zoom)' : '부산 확대'}
            showLabels={showLabels}
            locale={locale}
            x={12}
            y={12 + INSET_H + 16 + SUGOKWON_H + 16 + METRO_INSET_H + 16}
            width={METRO_INSET_W}
            height={METRO_INSET_H}
            bbox={BUSAN_BBOX}
          />
        </>
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
    </div>
  );
}
