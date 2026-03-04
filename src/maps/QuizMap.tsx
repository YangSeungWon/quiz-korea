import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { MultiLineString } from 'geojson';
import type { RegionCollection, RegionFeature, MapDisplayMode, Locale } from '../types';
import { getRegionCode, getDisplayName } from '../utils/regionUtils';
import { SIDO_SHORT_EN } from '../i18n/regions/sido';

// Helper to avoid D3 generics mismatch on .attr('d', path)
function pathAttr(path: d3.GeoPath): (d: RegionFeature) => string {
  return (d: RegionFeature) => path(d) ?? '';
}

// Inset cities (7 metropolitan areas) — 인천 last (spans 2 cols, wide shape)
const INSET_CITIES_KO = [
  { code: '11', label: '서울' },
  { code: '26', label: '부산' },
  { code: '27', label: '대구' },
  { code: '29', label: '광주' },
  { code: '30', label: '대전' },
  { code: '31', label: '울산' },
  { code: '28', label: '인천' },
] as const;

const INSET_CITY_CODES = INSET_CITIES_KO.map((c) => c.code);

const INSET_COL_WIDTH = 180;
const INSET_ROWS = 4; // 7 cities in 2-col grid: 3 full rows + 1 spanning row
const INSET_COLS = 2;

// Shared layout calculation used by both D3 rendering and SVG sizing
function computeInsetLayout(width: number, height: number, showInsets: boolean, displayMode: MapDisplayMode) {
  const effectiveInsets = showInsets && displayMode !== 'outline-only';
  const insetRight = effectiveInsets && width >= 700;
  const insetBottom = effectiveInsets && !insetRight;
  const insetColW = insetRight
    ? Math.max(100, Math.min(INSET_COL_WIDTH, Math.floor(width * 0.2)))
    : Math.floor(width / INSET_COLS);
  const insetRowH = insetRight
    ? Math.floor(height / INSET_ROWS)
    : insetColW; // square cells based on width
  const mainWidth = insetRight ? width - insetColW * INSET_COLS : width;
  const mainHeight = insetBottom ? Math.floor(width * 1.3) : height;
  return { effectiveInsets, insetRight, insetBottom, insetColW, insetRowH, mainWidth, mainHeight };
}

function computeSvgHeight(width: number, height: number, showInsets: boolean, displayMode: MapDisplayMode) {
  if (width === 0 || height === 0) return height;
  const { insetBottom, insetRowH, mainHeight } = computeInsetLayout(width, height, showInsets, displayMode);
  if (!insetBottom) return height; // landscape: exactly viewport height
  return mainHeight + insetRowH * (INSET_ROWS - 1) + Math.floor(insetRowH * 1.5);
}

interface QuizMapProps {
  geoData: RegionCollection;
  topoData: Topology;
  borderMesh?: MultiLineString | null;
  displayMode: MapDisplayMode;
  width: number;
  height: number;
  showInsets?: boolean;
  locale?: Locale;
  targetRegionCode?: string | null;
  answeredCodes: Map<string, number>;
  wrongFlashCode: string | null;
  hoveredCode?: string | null;
  onRegionClick?: (code: string) => void;
  onRegionHover?: (code: string | null) => void;
  showLabels?: boolean;
  resetZoom?: boolean;
}

const COLORS = {
  unanswered: '#e5e7eb',
  correct: '#86efac',
  mistake1: '#fde047',
  mistake2: '#fb923c',
  mistake3: '#f87171',
  hover: '#bfdbfe',
  target: '#60a5fa',
  wrongFlash: '#f87171',
  stroke: '#9ca3af',
  strokeHover: '#374151',
  outlineStroke: '#374151',
};

function getAnsweredFill(answeredCodes: Map<string, number>, code: string): string {
  const mistakes = answeredCodes.get(code);
  if (mistakes === undefined) return COLORS.unanswered;
  if (mistakes === 0) return COLORS.correct;
  if (mistakes === 1) return COLORS.mistake1;
  if (mistakes === 2) return COLORS.mistake2;
  return COLORS.mistake3;
}

function getInsetLabel(code: string, locale: Locale): string {
  if (locale === 'en') return SIDO_SHORT_EN[code] || code;
  const city = INSET_CITIES_KO.find((c) => c.code === code);
  return city?.label || code;
}

export default function QuizMap({
  geoData,
  topoData,
  borderMesh,
  displayMode,
  width,
  height,
  showInsets = false,
  locale = 'ko',
  targetRegionCode,
  answeredCodes,
  wrongFlashCode,
  onRegionClick,
  onRegionHover,
  showLabels = false,
  resetZoom = false,
}: QuizMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomTransformRef = useRef(d3.zoomIdentity);
  const prevGeoDataRef = useRef(geoData);
  const prevResetZoomRef = useRef(resetZoom);

  useEffect(() => {
    if (!svgRef.current || !geoData || width === 0 || height === 0) return;

    // Reset zoom when data changes or resetZoom prop becomes true
    if (prevGeoDataRef.current !== geoData) {
      zoomTransformRef.current = d3.zoomIdentity;
      prevGeoDataRef.current = geoData;
    }
    if (resetZoom && !prevResetZoomRef.current) {
      zoomTransformRef.current = d3.zoomIdentity;
    }
    prevResetZoomRef.current = resetZoom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { effectiveInsets, insetRight, insetColW, insetRowH, mainWidth, mainHeight } =
      computeInsetLayout(width, height, showInsets, displayMode);

    // Nested SVG for main map — creates its own viewport, fully isolated from insets
    const mainSvg = svg.append('svg')
      .attr('width', mainWidth)
      .attr('height', mainHeight)
      .attr('overflow', 'hidden');
    const g = mainSvg.append('g');

    // Apply stored zoom transform and set up zoom behavior
    g.attr('transform', zoomTransformRef.current.toString());
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 4])
      .translateExtent([[0, 0], [mainWidth, mainHeight]])
      .filter((event) => {
        // Block zoom events originating from inset areas
        const target = event.target as Element;
        if (target && target.closest && target.closest('.inset-group')) return false;
        return true;
      })
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        zoomTransformRef.current = event.transform;
      });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mainSvg as any).call(zoom);
    if (zoomTransformRef.current !== d3.zoomIdentity) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mainSvg as any).call(zoom.transform, zoomTransformRef.current);
    }
    const projection = d3.geoMercator();

    if (displayMode === 'outline-only' && targetRegionCode) {
      // Show only the target region, fitted to viewport
      const targetFeature = geoData.features.find(
        (f) => getRegionCode(f) === targetRegionCode,
      );
      if (targetFeature) {
        const singleCollection: RegionCollection = {
          type: 'FeatureCollection',
          features: [targetFeature],
        };
        projection.fitExtent(
          [
            [40, 40],
            [width - 40, height - 40],
          ],
          singleCollection,
        );

        const path = d3.geoPath().projection(projection);

        g.selectAll('path')
          .data([targetFeature])
          .join('path')
          .attr('d', (d) => path(d) ?? '')
          .attr('fill', COLORS.unanswered)
          .attr('stroke', COLORS.outlineStroke)
          .attr('stroke-width', 2);

        return;
      }
    }

    // Normal or borderless mode: fit to main area
    projection.fitExtent(
      [
        [20, 20],
        [mainWidth - 20, mainHeight - 20],
      ],
      geoData,
    );

    const path = d3.geoPath().projection(projection);

    // Helper: get fill color in normal style (used for main normal mode + insets)
    const getNormalFill = (d: RegionFeature): string => {
      const code = getRegionCode(d);
      if (code === wrongFlashCode) return COLORS.wrongFlash;
      if (answeredCodes.has(code)) return getAnsweredFill(answeredCodes, code);
      if (code === targetRegionCode) return COLORS.target;
      return COLORS.unanswered;
    };

    if (displayMode === 'borderless') {
      // Draw country outline using topojson mesh (outer boundary only)
      try {
        const objectKey = Object.keys(topoData.objects)[0];
        const geometries = topoData.objects[objectKey] as GeometryCollection;
        const outerBoundary = topojson.mesh(topoData, geometries, (a, b) => a === b);

        g.append('path')
          .datum(outerBoundary)
          .attr('d', path(outerBoundary) ?? '')
          .attr('fill', 'none')
          .attr('stroke', COLORS.outlineStroke)
          .attr('stroke-width', 1.5);
      } catch {
        // Fallback: just draw without internal borders
      }

      // Invisible clickable regions
      g.selectAll('path.region')
        .data(geoData.features)
        .join('path')
        .attr('class', 'region')
        .attr('d', pathAttr(path))
        .attr('fill', (d: RegionFeature) => {
          const code = getRegionCode(d);
          if (code === wrongFlashCode) return COLORS.wrongFlash;
          if (answeredCodes.has(code)) return getAnsweredFill(answeredCodes, code);
          return 'transparent';
        })
        .attr('stroke', 'none')
        .style('cursor', 'pointer')
        .on('click', (_, d: RegionFeature) => {
          onRegionClick?.(getRegionCode(d));
        });
    } else {
      // Normal mode: full map with borders
      const hasMesh = !!borderMesh;
      g.selectAll('path.region')
        .data(geoData.features)
        .join('path')
        .attr('class', 'region')
        .attr('d', pathAttr(path))
        .attr('fill', getNormalFill)
        .attr('stroke', hasMesh ? 'none' : COLORS.stroke)
        .attr('stroke-width', hasMesh ? 0 : 0.5)
        .style('cursor', 'pointer')
        .style('transition', 'fill 0.15s ease')
        .on('click', (_, d: RegionFeature) => {
          onRegionClick?.(getRegionCode(d));
        })
        .on('mouseenter', (event: MouseEvent, d: RegionFeature) => {
          const code = getRegionCode(d);
          const el = d3.select(event.currentTarget as Element);
          if (!hasMesh) el.attr('stroke', COLORS.strokeHover).attr('stroke-width', 1.5);
          if (!answeredCodes.has(code) && code !== targetRegionCode && code !== wrongFlashCode) {
            el.attr('fill', COLORS.hover);
          }
          onRegionHover?.(getRegionCode(d));
        })
        .on('mouseleave', (event: MouseEvent, d: RegionFeature) => {
          const code = getRegionCode(d);
          const el = d3.select(event.currentTarget as Element);
          if (!hasMesh) el.attr('stroke', COLORS.stroke).attr('stroke-width', 0.5);
          if (code === wrongFlashCode) return;
          if (answeredCodes.has(code)) {
            el.attr('fill', getAnsweredFill(answeredCodes, code));
          } else if (code === targetRegionCode) {
            el.attr('fill', COLORS.target);
          } else {
            el.attr('fill', COLORS.unanswered);
          }
          onRegionHover?.(null);
        });

      // Separate border mesh layer (sigun mode: inter-group boundaries only)
      if (borderMesh) {
        g.append('path')
          .datum(borderMesh)
          .attr('d', path(borderMesh) ?? '')
          .attr('fill', 'none')
          .attr('stroke', COLORS.stroke)
          .attr('stroke-width', 0.5)
          .style('pointer-events', 'none');
      }
    }

    // Show labels on hover in learn mode
    if (showLabels) {
      const tooltip = g.append('g').attr('class', 'tooltip').style('pointer-events', 'none');

      g.selectAll('path.region, path:not(.region)')
        .on('mouseenter.label', (_event: MouseEvent, d: unknown) => {
          const feature = d as RegionFeature;
          const name = getDisplayName(feature, locale);
          const centroid = path.centroid(feature as d3.GeoPermissibleObjects);

          tooltip.selectAll('*').remove();
          tooltip
            .append('text')
            .attr('x', centroid[0])
            .attr('y', centroid[1])
            .attr('text-anchor', 'middle')
            .attr('dy', '-0.5em')
            .attr('font-size', '13px')
            .attr('font-weight', '600')
            .attr('fill', '#1f2937')
            .attr('stroke', 'white')
            .attr('stroke-width', 3)
            .attr('paint-order', 'stroke')
            .text(name);
        })
        .on('mouseleave.label', () => {
          tooltip.selectAll('*').remove();
        });
    }

    // Render inset maps for metropolitan areas
    if (effectiveInsets) {
      const insetPad = 3;
      const labelH = 14;

      INSET_CITY_CODES.forEach((cityCode, i) => {
        const cityFeatures = geoData.features.filter((f) =>
          getRegionCode(f).startsWith(cityCode),
        );
        if (cityFeatures.length === 0) return;

        // Position: right 2-column grid (last item spans 2 cols) or bottom row
        let x: number, y: number, boxW: number, boxH: number;
        if (insetRight) {
          const isLast = i === INSET_CITY_CODES.length - 1;
          const col = i % INSET_COLS;
          const row = Math.floor(i / INSET_COLS);
          boxW = isLast ? insetColW * INSET_COLS : insetColW;
          boxH = isLast ? insetRowH * 1.5 : insetRowH;
          x = mainWidth + (isLast ? 0 : col * insetColW);
          y = row * insetRowH;
        } else {
          const isLast = i === INSET_CITY_CODES.length - 1;
          const col = i % INSET_COLS;
          const row = Math.floor(i / INSET_COLS);
          boxW = isLast ? insetColW * INSET_COLS : insetColW;
          boxH = isLast ? insetRowH * 1.5 : insetRowH;
          x = isLast ? 0 : col * insetColW;
          y = mainHeight + row * insetRowH;
        }

        const insetG = svg.append('g').attr('class', 'inset-group').attr('transform', `translate(${x},${y})`);

        // Background box
        insetG
          .append('rect')
          .attr('x', 1)
          .attr('y', 1)
          .attr('width', boxW - 2)
          .attr('height', boxH - 2)
          .attr('fill', 'white')
          .attr('stroke', '#d1d5db')
          .attr('stroke-width', 0.5)
          .attr('rx', 3);

        // City label
        insetG
          .append('text')
          .attr('x', boxW / 2)
          .attr('y', labelH)
          .attr('text-anchor', 'middle')
          .attr('font-size', insetRight ? '10px' : '9px')
          .attr('font-weight', '600')
          .attr('fill', '#374151')
          .text(getInsetLabel(cityCode, locale));

        // Independent projection for this city
        const cityCollection: RegionCollection = {
          type: 'FeatureCollection',
          features: cityFeatures,
        };

        const insetProj = d3.geoMercator().fitExtent(
          [
            [insetPad, labelH + insetPad],
            [boxW - insetPad, boxH - insetPad],
          ],
          cityCollection,
        );
        const insetPath = d3.geoPath().projection(insetProj);

        // Render regions (always in normal style within insets)
        insetG
          .selectAll('path.inset-region')
          .data(cityFeatures)
          .join('path')
          .attr('class', 'inset-region')
          .attr('d', pathAttr(insetPath))
          .attr('fill', getNormalFill)
          .attr('stroke', COLORS.stroke)
          .attr('stroke-width', 0.3)
          .style('cursor', 'pointer')
          .style('transition', 'fill 0.15s ease')
          .on('click', (_, d: RegionFeature) => {
            onRegionClick?.(getRegionCode(d));
          })
          .on('mouseenter', (event: MouseEvent, d: RegionFeature) => {
            const code = getRegionCode(d);
            const el = d3.select(event.currentTarget as Element);
            el.attr('stroke', COLORS.strokeHover).attr('stroke-width', 1);
            if (!answeredCodes.has(code) && code !== targetRegionCode && code !== wrongFlashCode) {
              el.attr('fill', COLORS.hover);
            }
            onRegionHover?.(getRegionCode(d));
          })
          .on('mouseleave', (event: MouseEvent, d: RegionFeature) => {
            const code = getRegionCode(d);
            const el = d3.select(event.currentTarget as Element);
            el.attr('stroke', COLORS.stroke).attr('stroke-width', 0.3);
            if (code === wrongFlashCode) return;
            if (answeredCodes.has(code)) {
              el.attr('fill', getAnsweredFill(answeredCodes, code));
            } else if (code === targetRegionCode) {
              el.attr('fill', COLORS.target);
            } else {
              el.attr('fill', COLORS.unanswered);
            }
            onRegionHover?.(null);
          });

        // Learn mode labels for inset regions
        if (showLabels) {
          const insetTooltip = insetG.append('g').style('pointer-events', 'none');

          insetG
            .selectAll('path.inset-region')
            .on('mouseenter.label', (_event: MouseEvent, d: unknown) => {
              const feature = d as RegionFeature;
              const name = getDisplayName(feature, locale);
              const centroid = insetPath.centroid(feature as d3.GeoPermissibleObjects);

              insetTooltip.selectAll('*').remove();
              insetTooltip
                .append('text')
                .attr('x', centroid[0])
                .attr('y', centroid[1])
                .attr('text-anchor', 'middle')
                .attr('dy', '-0.5em')
                .attr('font-size', '9px')
                .attr('font-weight', '600')
                .attr('fill', '#1f2937')
                .attr('stroke', 'white')
                .attr('stroke-width', 3)
                .attr('paint-order', 'stroke')
                .text(name);
            })
            .on('mouseleave.label', () => {
              insetTooltip.selectAll('*').remove();
            });
        }
      });
    }
  }, [geoData, topoData, borderMesh, displayMode, width, height, showInsets, locale, targetRegionCode, answeredCodes, wrongFlashCode, onRegionClick, onRegionHover, showLabels, resetZoom]);

  const computedHeight = computeSvgHeight(width, height, showInsets, displayMode);

  return (
    <svg
      ref={svgRef}
      width={width}
      height={computedHeight}
      viewBox={`0 0 ${width} ${computedHeight}`}
      className="block mx-auto"
      style={{ touchAction: 'none' }}
    />
  );
}
