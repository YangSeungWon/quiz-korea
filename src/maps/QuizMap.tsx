import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { MultiLineString } from 'geojson';
import type { RegionCollection, RegionFeature, MapDisplayMode, Locale } from '../types';
import { getRegionCode, getDisplayName } from '../utils/regionUtils';
// Helper to avoid D3 generics mismatch on .attr('d', path)
function pathAttr(path: d3.GeoPath): (d: RegionFeature) => string {
  return (d: RegionFeature) => path(d) ?? '';
}

// Inset zones: dense cores of metro areas + Suwon (bbox = [minLon, minLat, maxLon, maxLat])
const INSET_ZONES: readonly { label: string; labelEn: string; bbox: readonly [number, number, number, number] }[] = [
  { label: '서울', labelEn: 'Seoul', bbox: [126.76, 37.43, 127.18, 37.70] },
  { label: '부산', labelEn: 'Busan', bbox: [128.96, 35.05, 129.21, 35.28] },
  { label: '대구', labelEn: 'Daegu', bbox: [128.47, 35.77, 128.73, 35.99] },
  { label: '광주', labelEn: 'Gwangju', bbox: [126.75, 35.05, 127.02, 35.26] },
  { label: '대전', labelEn: 'Daejeon', bbox: [127.28, 36.18, 127.56, 36.48] },
  { label: '울산', labelEn: 'Ulsan', bbox: [129.24, 35.45, 129.46, 35.68] },
  { label: '인천', labelEn: 'Incheon', bbox: [126.56, 37.34, 126.79, 37.64] },
  { label: '수원', labelEn: 'Suwon', bbox: [126.93, 37.22, 127.09, 37.35] },
];

function featureInBbox(feature: RegionFeature, bbox: readonly [number, number, number, number]): boolean {
  const [lon, lat] = d3.geoCentroid(feature);
  return lon >= bbox[0] && lon <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];
}

const INSET_COL_WIDTH = 180;
const INSET_ROWS = 4; // 8 zones in 2-col × 4-row grid
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
  return mainHeight + insetRowH * INSET_ROWS;
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

    // Nested SVG clips main map content; zoom is on parent SVG
    const mainSvg = svg.append('svg')
      .attr('width', mainWidth)
      .attr('height', mainHeight)
      .attr('overflow', 'hidden');
    const g = mainSvg.append('g');

    // Apply stored zoom transform and set up zoom behavior
    g.attr('transform', zoomTransformRef.current.toString());
    let miniProj: d3.GeoProjection | null = null;

    function updateMinimapViewport(transform: d3.ZoomTransform) {
      const mm = mainSvg.select('.minimap');
      if (mm.empty() || !miniProj) return;
      if (transform.k <= 1) {
        mm.style('opacity', 0);
        return;
      }
      mm.style('opacity', 1);
      const inv = projection.invert!;
      const tl = miniProj(inv([-transform.x / transform.k, -transform.y / transform.k])!);
      const br = miniProj(inv([
        (-transform.x + mainWidth) / transform.k,
        (-transform.y + mainHeight) / transform.k,
      ])!);
      if (tl && br) {
        mm.select('.mini-viewport')
          .attr('x', tl[0]).attr('y', tl[1])
          .attr('width', br[0] - tl[0]).attr('height', br[1] - tl[1]);
      }
    }

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 4])
      .extent([[0, 0], [mainWidth, mainHeight]])
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
        updateMinimapViewport(event.transform);
      });
    svg.call(zoom);
    if (zoomTransformRef.current !== d3.zoomIdentity) {
      svg.call(zoom.transform, zoomTransformRef.current);
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

    // Minimap: visible only when zoomed in
    {
      const MINI_W = 100;
      const MINI_H = Math.round(MINI_W * mainHeight / mainWidth);
      const miniPadding = 4;
      const miniG = mainSvg.append('g')
        .attr('class', 'minimap')
        .attr('transform', `translate(8,${mainHeight - MINI_H - 8})`)
        .style('opacity', 0)
        .style('pointer-events', 'none');

      miniG.append('rect')
        .attr('width', MINI_W).attr('height', MINI_H)
        .attr('fill', 'white').attr('fill-opacity', 0.9)
        .attr('stroke', '#9ca3af').attr('stroke-width', 0.5)
        .attr('rx', 3);

      miniProj = d3.geoMercator().fitExtent(
        [[miniPadding, miniPadding], [MINI_W - miniPadding, MINI_H - miniPadding]],
        geoData,
      );
      const miniPath = d3.geoPath().projection(miniProj);

      miniG.selectAll('path')
        .data(geoData.features)
        .join('path')
        .attr('d', (d) => miniPath(d) ?? '')
        .attr('fill', '#d1d5db')
        .attr('stroke', '#9ca3af')
        .attr('stroke-width', 0.15);

      miniG.append('rect')
        .attr('class', 'mini-viewport')
        .attr('fill', 'rgba(96, 165, 250, 0.25)')
        .attr('stroke', '#3b82f6')
        .attr('stroke-width', 1)
        .attr('rx', 1);

      // Show minimap if already zoomed (e.g. restored zoom state)
      if (zoomTransformRef.current.k > 1) {
        updateMinimapViewport(zoomTransformRef.current);
      }
    }

    // Render inset maps for dense metro cores
    if (effectiveInsets) {
      const insetPad = 3;
      const labelH = 14;

      INSET_ZONES.forEach((zone, i) => {
        const zoneFeatures = geoData.features.filter((f) => featureInBbox(f, zone.bbox));
        if (zoneFeatures.length === 0) return;

        // Position: uniform 2-col × 4-row grid
        const col = i % INSET_COLS;
        const row = Math.floor(i / INSET_COLS);
        const boxW = insetColW;
        const boxH = insetRowH;
        const x = (insetRight ? mainWidth : 0) + col * insetColW;
        const y = (insetRight ? 0 : mainHeight) + row * insetRowH;

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

        // Zone label
        const labelText = locale === 'en' ? zone.labelEn : zone.label;
        insetG
          .append('text')
          .attr('x', boxW / 2)
          .attr('y', labelH)
          .attr('text-anchor', 'middle')
          .attr('font-size', insetRight ? '10px' : '9px')
          .attr('font-weight', '600')
          .attr('fill', '#374151')
          .text(labelText);

        // Independent projection fitted to zone features
        const zoneCollection: RegionCollection = {
          type: 'FeatureCollection',
          features: zoneFeatures,
        };

        const insetProj = d3.geoMercator().fitExtent(
          [
            [insetPad, labelH + insetPad],
            [boxW - insetPad, boxH - insetPad],
          ],
          zoneCollection,
        );
        const insetPath = d3.geoPath().projection(insetProj);

        // Render regions (always in normal style within insets)
        insetG
          .selectAll('path.inset-region')
          .data(zoneFeatures)
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
