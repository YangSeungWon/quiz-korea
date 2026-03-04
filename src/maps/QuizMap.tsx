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

// Inset zones: dense cores where sigungu are too small to click (north→south order)
const INSET_ZONES: readonly { label: string; labelEn: string; bbox: readonly [number, number, number, number]; color: string }[] = [
  { label: '수도권', labelEn: 'Capital', bbox: [126.46, 37.22, 127.25, 37.75], color: '#4f46e5' },
  { label: '대구', labelEn: 'Daegu', bbox: [128.47, 35.77, 128.73, 35.99], color: '#059669' },
  { label: '부산', labelEn: 'Busan', bbox: [128.96, 35.05, 129.21, 35.28], color: '#dc2626' },
];

function featureOverlapsBbox(feature: RegionFeature, bbox: readonly [number, number, number, number]): boolean {
  const [[fMinLon, fMinLat], [fMaxLon, fMaxLat]] = d3.geoBounds(feature);
  return fMaxLon >= bbox[0] && fMinLon <= bbox[2] && fMaxLat >= bbox[1] && fMinLat <= bbox[3];
}

// Mercator aspect ratio (w/h) for a geographic bbox
function bboxAspect(bbox: readonly [number, number, number, number]): number {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const w = (maxLon - minLon) * Math.PI / 180;
  const toRad = Math.PI / 180;
  const h = Math.log(Math.tan(Math.PI / 4 + maxLat * toRad / 2))
          - Math.log(Math.tan(Math.PI / 4 + minLat * toRad / 2));
  return w / h;
}

interface InsetBox { x: number; y: number; w: number; h: number }

// Layout: 수도권 wide on top, 대구+부산 split below — sized to match bbox aspect ratios
function computeInsetLayout(width: number, height: number, showInsets: boolean, displayMode: MapDisplayMode) {
  const effectiveInsets = showInsets && displayMode !== 'outline-only';
  const insetRight = effectiveInsets && width >= 700;
  const insetBottom = effectiveInsets && !insetRight;
  const boxes: InsetBox[] = [];
  let mainWidth: number, mainHeight: number;

  const aspCapital = bboxAspect(INSET_ZONES[0].bbox);
  const aspDaegu = bboxAspect(INSET_ZONES[1].bbox);
  const aspBusan = bboxAspect(INSET_ZONES[2].bbox);

  if (insetRight) {
    const panelW = Math.max(280, Math.min(520, Math.floor(width * 0.45)));
    mainWidth = width - panelW;
    mainHeight = height;

    const idealTopH = panelW / aspCapital;
    const idealBotH = panelW / (aspDaegu + aspBusan);
    const scale = Math.min(1, height / (idealTopH + idealBotH));
    const topH = Math.floor(idealTopH * scale);
    const botH = Math.floor(idealBotH * scale);
    const daeguW = Math.floor(panelW * aspDaegu / (aspDaegu + aspBusan));

    boxes.push({ x: mainWidth, y: 0, w: panelW, h: topH });                      // 수도권
    boxes.push({ x: mainWidth, y: topH, w: daeguW, h: botH });                    // 대구
    boxes.push({ x: mainWidth + daeguW, y: topH, w: panelW - daeguW, h: botH });  // 부산
  } else if (insetBottom) {
    mainWidth = width;
    mainHeight = Math.floor(width * 1.3);

    const topRowH = Math.floor(width / aspCapital);
    const botRowH = Math.floor(width / (aspDaegu + aspBusan));
    const daeguW = Math.floor(width * aspDaegu / (aspDaegu + aspBusan));

    boxes.push({ x: 0, y: mainHeight, w: width, h: topRowH });                    // 수도권
    boxes.push({ x: 0, y: mainHeight + topRowH, w: daeguW, h: botRowH });         // 대구
    boxes.push({ x: daeguW, y: mainHeight + topRowH, w: width - daeguW, h: botRowH }); // 부산
  } else {
    mainWidth = width;
    mainHeight = height;
  }

  return { effectiveInsets, insetRight, insetBottom, mainWidth, mainHeight, boxes };
}

function computeSvgHeight(width: number, height: number, showInsets: boolean, displayMode: MapDisplayMode) {
  if (width === 0 || height === 0) return height;
  const { insetBottom, mainHeight, boxes } = computeInsetLayout(width, height, showInsets, displayMode);
  if (!insetBottom) return height;
  return boxes.reduce((max, b) => Math.max(max, b.y + b.h), mainHeight);
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

  // Refs for props that change frequently (fills, callbacks) to avoid full SVG rebuild
  const answeredCodesRef = useRef(answeredCodes);
  const wrongFlashCodeRef = useRef(wrongFlashCode);
  const targetRegionCodeRef = useRef(targetRegionCode);
  const onRegionClickRef = useRef(onRegionClick);
  const onRegionHoverRef = useRef(onRegionHover);
  answeredCodesRef.current = answeredCodes;
  wrongFlashCodeRef.current = wrongFlashCode;
  targetRegionCodeRef.current = targetRegionCode;
  onRegionClickRef.current = onRegionClick;
  onRegionHoverRef.current = onRegionHover;

  // In outline-only mode, target change needs structural rebuild
  const structuralTargetCode = displayMode === 'outline-only' ? targetRegionCode : undefined;

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

    const { effectiveInsets, mainWidth, mainHeight, boxes } =
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
      if (code === wrongFlashCodeRef.current) return COLORS.wrongFlash;
      if (answeredCodesRef.current.has(code)) return getAnsweredFill(answeredCodesRef.current, code);
      if (code === targetRegionCodeRef.current) return COLORS.target;
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
          if (code === wrongFlashCodeRef.current) return COLORS.wrongFlash;
          if (answeredCodesRef.current.has(code)) return getAnsweredFill(answeredCodesRef.current, code);
          return 'transparent';
        })
        .attr('stroke', 'none')
        .style('cursor', 'pointer')
        .on('click', (_, d: RegionFeature) => {
          onRegionClickRef.current?.(getRegionCode(d));
        });
    } else {
      // Normal mode: full map with borders
      const hasMesh = !!borderMesh;
      g.selectAll('path.region')
        .data(geoData.features)
        .join('path')
        .attr('class', 'region')
        .attr('data-code', (d: RegionFeature) => getRegionCode(d))
        .attr('d', pathAttr(path))
        .attr('fill', getNormalFill)
        .attr('stroke', hasMesh ? 'none' : COLORS.stroke)
        .attr('stroke-width', hasMesh ? 0 : 1.2)
        .style('cursor', 'pointer')
        .style('transition', 'fill 0.15s ease')
        .on('click', (_, d: RegionFeature) => {
          onRegionClickRef.current?.(getRegionCode(d));
        })
        .on('mouseenter', (event: MouseEvent, d: RegionFeature) => {
          const code = getRegionCode(d);
          const el = d3.select(event.currentTarget as Element);
          if (!hasMesh) el.attr('stroke', COLORS.strokeHover).attr('stroke-width', 1.5);
          if (!answeredCodesRef.current.has(code) && code !== targetRegionCodeRef.current && code !== wrongFlashCodeRef.current) {
            el.attr('fill', COLORS.hover);
          }
          onRegionHoverRef.current?.(getRegionCode(d));
        })
        .on('mouseleave', (event: MouseEvent, d: RegionFeature) => {
          const code = getRegionCode(d);
          const el = d3.select(event.currentTarget as Element);
          if (!hasMesh) el.attr('stroke', COLORS.stroke).attr('stroke-width', 1.2);
          if (code === wrongFlashCodeRef.current) return;
          if (answeredCodesRef.current.has(code)) {
            el.attr('fill', getAnsweredFill(answeredCodesRef.current, code));
          } else if (code === targetRegionCodeRef.current) {
            el.attr('fill', COLORS.target);
          } else {
            el.attr('fill', COLORS.unanswered);
          }
          onRegionHoverRef.current?.(null);
        });

      // Separate border mesh layer (sigun mode: inter-group boundaries only)
      if (borderMesh) {
        g.append('path')
          .datum(borderMesh)
          .attr('d', path(borderMesh) ?? '')
          .attr('fill', 'none')
          .attr('stroke', COLORS.stroke)
          .attr('stroke-width', 1.2)
          .style('pointer-events', 'none');
      }
    }

    // Draw bbox rectangles on main map to show inset coverage areas
    if (effectiveInsets) {
      INSET_ZONES.forEach((zone) => {
        const [minLon, minLat, maxLon, maxLat] = zone.bbox;
        const tl = projection([minLon, maxLat]);
        const br = projection([maxLon, minLat]);
        if (!tl || !br) return;
        g.append('rect')
          .attr('x', tl[0]).attr('y', tl[1])
          .attr('width', br[0] - tl[0]).attr('height', br[1] - tl[1])
          .attr('fill', 'none')
          .attr('stroke', zone.color)
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', '6,3')
          .attr('rx', 2)
          .style('pointer-events', 'none');
      });
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
      const insetPad = 0;

      INSET_ZONES.forEach((zone, i) => {
        const zoneFeatures = geoData.features.filter((f) => featureOverlapsBbox(f, zone.bbox));
        if (zoneFeatures.length === 0 || !boxes[i]) return;

        const { x, y, w: boxW, h: boxH } = boxes[i];

        const insetG = svg.append('g').attr('class', 'inset-group').attr('transform', `translate(${x},${y})`);

        // White background (below regions)
        insetG
          .append('rect')
          .attr('x', 1)
          .attr('y', 1)
          .attr('width', boxW - 2)
          .attr('height', boxH - 2)
          .attr('fill', 'white')
          .attr('stroke', 'none')
          .attr('rx', 3);

        // Independent projection fitted to zone bbox
        const [minLon, minLat, maxLon, maxLat] = zone.bbox;
        const bboxGeoJSON: RegionCollection = {
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            properties: {},
            geometry: { type: 'Polygon', coordinates: [[[minLon, minLat], [minLon, maxLat], [maxLon, maxLat], [maxLon, minLat], [minLon, minLat]]] },
          } as unknown as RegionFeature],
        };

        const insetProj = d3.geoMercator().fitExtent(
          [
            [insetPad, insetPad],
            [boxW - insetPad, boxH - insetPad],
          ],
          bboxGeoJSON,
        );
        const insetPath = d3.geoPath().projection(insetProj);

        // Clip regions to bbox area
        const clipId = `inset-clip-${i}`;
        const clipTL = insetProj([minLon, maxLat])!;
        const clipBR = insetProj([maxLon, minLat])!;
        insetG.append('defs').append('clipPath').attr('id', clipId)
          .append('rect')
          .attr('x', clipTL[0]).attr('y', clipTL[1])
          .attr('width', clipBR[0] - clipTL[0]).attr('height', clipBR[1] - clipTL[1]);

        const clippedG = insetG.append('g').attr('clip-path', `url(#${clipId})`);

        // Render regions (always in normal style within insets)
        clippedG
          .selectAll('path.inset-region')
          .data(zoneFeatures)
          .join('path')
          .attr('class', 'inset-region')
          .attr('d', pathAttr(insetPath))
          .attr('fill', getNormalFill)
          .attr('stroke', COLORS.stroke)
          .attr('stroke-width', 1.5)
          .style('cursor', 'pointer')
          .style('transition', 'fill 0.15s ease')
          .on('click', (_, d: RegionFeature) => {
            onRegionClickRef.current?.(getRegionCode(d));
          })
          .on('mouseenter', (event: MouseEvent, d: RegionFeature) => {
            const code = getRegionCode(d);
            const el = d3.select(event.currentTarget as Element);
            el.attr('stroke', COLORS.strokeHover).attr('stroke-width', 2);
            if (!answeredCodesRef.current.has(code) && code !== targetRegionCodeRef.current && code !== wrongFlashCodeRef.current) {
              el.attr('fill', COLORS.hover);
            }
            // Highlight on main map too
            const mainEl = g.select(`path.region[data-code="${code}"]`);
            if (!mainEl.empty() && !answeredCodesRef.current.has(code) && code !== targetRegionCodeRef.current && code !== wrongFlashCodeRef.current) {
              mainEl.attr('fill', COLORS.hover);
            }
            onRegionHoverRef.current?.(getRegionCode(d));
          })
          .on('mouseleave', (event: MouseEvent, d: RegionFeature) => {
            const code = getRegionCode(d);
            const el = d3.select(event.currentTarget as Element);
            el.attr('stroke', COLORS.stroke).attr('stroke-width', 1.5);
            if (code === wrongFlashCodeRef.current) return;
            if (answeredCodesRef.current.has(code)) {
              el.attr('fill', getAnsweredFill(answeredCodesRef.current, code));
            } else if (code === targetRegionCodeRef.current) {
              el.attr('fill', COLORS.target);
            } else {
              el.attr('fill', COLORS.unanswered);
            }
            // Unhighlight on main map too
            const mainEl = g.select(`path.region[data-code="${code}"]`);
            if (!mainEl.empty()) {
              if (answeredCodesRef.current.has(code)) mainEl.attr('fill', getAnsweredFill(answeredCodesRef.current, code));
              else if (code === targetRegionCodeRef.current) mainEl.attr('fill', COLORS.target);
              else mainEl.attr('fill', COLORS.unanswered);
            }
            onRegionHoverRef.current?.(null);
          });

        // Border frame on top of regions
        insetG
          .append('rect')
          .attr('x', 1)
          .attr('y', 1)
          .attr('width', boxW - 2)
          .attr('height', boxH - 2)
          .attr('fill', 'none')
          .attr('stroke', zone.color)
          .attr('stroke-width', 2.5)
          .attr('rx', 3)
          .style('pointer-events', 'none');

        // Zone label overlay
        const labelText = locale === 'en' ? zone.labelEn : zone.label;
        insetG
          .append('text')
          .attr('x', 6)
          .attr('y', 14)
          .attr('font-size', '11px')
          .attr('font-weight', '700')
          .attr('fill', zone.color)
          .attr('stroke', 'white')
          .attr('stroke-width', 3)
          .attr('paint-order', 'stroke')
          .style('pointer-events', 'none')
          .text(labelText);

        // Learn mode labels for inset regions
        if (showLabels) {
          const insetTooltip = insetG.append('g').style('pointer-events', 'none');

          clippedG
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
                .attr('font-size', '13px')
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoData, topoData, borderMesh, displayMode, width, height, showInsets, locale, structuralTargetCode, showLabels, resetZoom]);

  // Lightweight fill-update effect: only changes fill colors without rebuilding SVG
  useEffect(() => {
    if (!svgRef.current || displayMode === 'outline-only') return;
    const svg = d3.select(svgRef.current);

    // Update main map regions
    svg.selectAll<SVGPathElement, RegionFeature>('path.region').each(function (d) {
      const code = getRegionCode(d);
      let fill: string;
      if (code === wrongFlashCode) fill = COLORS.wrongFlash;
      else if (answeredCodes.has(code)) fill = getAnsweredFill(answeredCodes, code);
      else if (displayMode === 'borderless') fill = 'transparent';
      else if (code === targetRegionCode) fill = COLORS.target;
      else fill = COLORS.unanswered;
      d3.select(this).attr('fill', fill);
    });

    // Update inset regions
    svg.selectAll<SVGPathElement, RegionFeature>('path.inset-region').each(function (d) {
      const code = getRegionCode(d);
      let fill: string;
      if (code === wrongFlashCode) fill = COLORS.wrongFlash;
      else if (answeredCodes.has(code)) fill = getAnsweredFill(answeredCodes, code);
      else if (code === targetRegionCode) fill = COLORS.target;
      else fill = COLORS.unanswered;
      d3.select(this).attr('fill', fill);
    });
  }, [answeredCodes, wrongFlashCode, targetRegionCode, displayMode]);

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
