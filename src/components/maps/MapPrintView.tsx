import { useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useMapData } from '../../hooks/useMapData';
import { extractRegions, getSidoMeta } from '../../utils/regionUtils';
import { useI18n } from '../../i18n/useI18n';
import QuizMap from '../../maps/QuizMap';
import type { AdminLevel } from '../../types';

// A4 portrait at 96dpi = 794.5 × 1123.6 px. We use full bleed (margin 0 in page.pdf)
// so the content needs to fit this exact box.
const PRINT_WIDTH = 794;
const PRINT_HEIGHT = 1123;

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

  const emptyAnswered = useMemo(() => new Map<string, number>(), []);
  // Print view: never use inset panels — print blank maps follow traditional flat layout
  const showInsets = false;

  // Mark this page noindex — these are puppeteer-internal routes
  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'robots');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'noindex,nofollow');
    // Force the page to be exactly one A4 landscape sheet, no margins/scrollbars
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

  // Region extraction triggers data ready signal; not used directly here
  useMemo(() => (filteredGeoData ? extractRegions(filteredGeoData, sidoMeta?.code, locale) : []), [filteredGeoData, sidoMeta, locale]);

  if (loading || !filteredGeoData || !topoData || error) {
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
        geoData={filteredGeoData}
        contextGeoData={sidoMeta ? geoData : null}
        topoData={topoData}
        borderMesh={sidoMeta ? null : borderMesh}
        displayMode="normal"
        width={PRINT_WIDTH}
        height={PRINT_HEIGHT}
        showInsets={showInsets}
        adminLevel={adminLevel}
        locale={locale}
        answeredCodes={emptyAnswered}
        wrongFlashCode={null}
        staticLabels={showLabels}
      />
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
