import { useEffect, useMemo, useRef } from 'react';
import { select } from 'd3-selection';
import { geoBounds, geoMercator, geoPath } from 'd3-geo';
import type { GeoPath, GeoProjection, GeoPermissibleObjects } from 'd3-geo';
import { zoom as d3Zoom, zoomIdentity } from 'd3-zoom';
import type { ZoomTransform } from 'd3-zoom';
import * as topojson from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { MultiLineString } from 'geojson';
import type { RegionCollection, RegionFeature, MapDisplayMode, Locale, AdminLevel } from '../types';
import { getRegionCode, getDisplayName } from '../utils/regionUtils';
// Helper to avoid D3 generics mismatch on .attr('d', path)
function pathAttr(path: GeoPath): (d: RegionFeature) => string {
  return (d: RegionFeature) => path(d) ?? '';
}

// Inset zones: dense cores where regions are too small to click (north→south order)
const INSET_ZONES: readonly { label: string; labelEn: string; bbox: readonly [number, number, number, number]; color: string; sigunguOnly?: boolean }[] = [
  { label: '수도권', labelEn: 'Capital', bbox: [126.46, 37.22, 127.25, 37.75], color: '#4f46e5' },
  { label: '대구', labelEn: 'Daegu', bbox: [128.47, 35.77, 128.73, 35.99], color: '#059669', sigunguOnly: true },
  { label: '부산', labelEn: 'Busan', bbox: [128.96, 35.05, 129.21, 35.28], color: '#dc2626', sigunguOnly: true },
];

function featureOverlapsBbox(feature: RegionFeature, bbox: readonly [number, number, number, number]): boolean {
  const [[fMinLon, fMinLat], [fMaxLon, fMaxLat]] = geoBounds(feature);
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
type InsetZone = typeof INSET_ZONES[number];

// Layout inset panels dynamically for any number of active zones
function computeInsetLayout(width: number, height: number, zones: readonly InsetZone[]) {
  const effectiveInsets = zones.length > 0;
  const insetRight = effectiveInsets && width >= 700;
  const insetBottom = effectiveInsets && !insetRight;
  const boxes: InsetBox[] = [];
  let mainWidth: number, mainHeight: number;

  if (insetRight) {
    const panelW = Math.max(280, Math.min(520, Math.floor(width * 0.45)));
    mainWidth = width - panelW;
    mainHeight = height;

    if (zones.length === 1) {
      const asp = bboxAspect(zones[0].bbox);
      const h = Math.min(Math.floor(panelW / asp), height);
      boxes.push({ x: mainWidth, y: 0, w: panelW, h });
    } else {
      // First zone on top row, remaining zones split horizontally on bottom row
      const asp0 = bboxAspect(zones[0].bbox);
      const restAspects = zones.slice(1).map(z => bboxAspect(z.bbox));
      const totalRestAsp = restAspects.reduce((a, b) => a + b, 0);
      const idealTopH = panelW / asp0;
      const idealBotH = panelW / totalRestAsp;
      const scale = Math.min(1, height / (idealTopH + idealBotH));
      const topH = Math.floor(idealTopH * scale);
      const botH = Math.floor(idealBotH * scale);

      boxes.push({ x: mainWidth, y: 0, w: panelW, h: topH });
      let xOff = 0;
      for (let j = 0; j < restAspects.length; j++) {
        const isLast = j === restAspects.length - 1;
        const w = isLast ? panelW - xOff : Math.floor(panelW * restAspects[j] / totalRestAsp);
        boxes.push({ x: mainWidth + xOff, y: topH, w, h: botH });
        xOff += w;
      }
    }
  } else if (insetBottom) {
    mainWidth = width;
    mainHeight = Math.floor(width * 1.3);

    if (zones.length === 1) {
      const asp = bboxAspect(zones[0].bbox);
      const h = Math.floor(width / asp);
      boxes.push({ x: 0, y: mainHeight, w: width, h });
    } else {
      const asp0 = bboxAspect(zones[0].bbox);
      const restAspects = zones.slice(1).map(z => bboxAspect(z.bbox));
      const totalRestAsp = restAspects.reduce((a, b) => a + b, 0);
      const topRowH = Math.floor(width / asp0);
      const botRowH = Math.floor(width / totalRestAsp);

      boxes.push({ x: 0, y: mainHeight, w: width, h: topRowH });
      let xOff = 0;
      for (let j = 0; j < restAspects.length; j++) {
        const isLast = j === restAspects.length - 1;
        const w = isLast ? width - xOff : Math.floor(width * restAspects[j] / totalRestAsp);
        boxes.push({ x: xOff, y: mainHeight + topRowH, w, h: botRowH });
        xOff += w;
      }
    }
  } else {
    mainWidth = width;
    mainHeight = height;
  }

  return { effectiveInsets, insetRight, insetBottom, mainWidth, mainHeight, boxes };
}

function computeSvgHeight(width: number, height: number, zones: readonly InsetZone[]) {
  if (width === 0 || height === 0) return height;
  const { insetBottom, mainHeight, boxes } = computeInsetLayout(width, height, zones);
  if (!insetBottom) return height;
  return boxes.reduce((max, b) => Math.max(max, b.y + b.h), mainHeight);
}

interface QuizMapProps {
  geoData: RegionCollection;
  contextGeoData?: RegionCollection | null;
  topoData: Topology;
  borderMesh?: MultiLineString | null;
  displayMode: MapDisplayMode;
  width: number;
  height: number;
  showInsets?: boolean;
  adminLevel?: AdminLevel;
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
  contextGeoData,
  topoData,
  borderMesh,
  displayMode,
  width,
  height,
  showInsets = false,
  adminLevel = 'sigungu',
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
  const regionElsRef = useRef<Map<string, SVGPathElement[]>>(new Map());
  const activeHoverCodeRef = useRef<string | null>(null);
  const zoomTransformRef = useRef(zoomIdentity);
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

  // Pre-compute zone→features mapping and active zones in one pass
  const { activeInsetZones, zoneFeaturesMap } = useMemo(() => {
    if (!showInsets || !geoData || displayMode === 'outline-only' || displayMode === 'borderless' || width < 700) {
      return { activeInsetZones: [] as InsetZone[], zoneFeaturesMap: new Map<InsetZone, RegionFeature[]>() };
    }
    const map = new Map<InsetZone, RegionFeature[]>();
    const active: InsetZone[] = [];
    for (const zone of INSET_ZONES) {
      if (zone.sigunguOnly && adminLevel !== 'sigungu') continue;
      const features = geoData.features.filter(f => featureOverlapsBbox(f, zone.bbox));
      if (features.length > 2) {
        map.set(zone, features);
        active.push(zone);
      }
    }
    return { activeInsetZones: active, zoneFeaturesMap: map };
  }, [showInsets, geoData, displayMode, adminLevel, width]);

  useEffect(() => {
    if (!svgRef.current || !geoData || width === 0 || height === 0) return;

    // Reset zoom when data changes or resetZoom prop becomes true
    if (prevGeoDataRef.current !== geoData) {
      zoomTransformRef.current = zoomIdentity;
      prevGeoDataRef.current = geoData;
    }
    if (resetZoom && !prevResetZoomRef.current) {
      zoomTransformRef.current = zoomIdentity;
    }
    prevResetZoomRef.current = resetZoom;

    const svg = select(svgRef.current);
    svg.selectAll('*').remove();
    const elIndex = new Map<string, SVGPathElement[]>();
    const indexEl = (code: string, el: SVGPathElement) => {
      const arr = elIndex.get(code);
      if (arr) arr.push(el); else elIndex.set(code, [el]);
    };

    // Touch tap detection: apply hover on tap, ignore drag/pinch
    let pointerStart: { id: number; x: number; y: number; target: SVGPathElement; code: string } | null = null;
    let activeTouches = 0;
    const TAP_THRESHOLD = 8;
    svg.on('pointerdown.tap', (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return;
      activeTouches++;
      if (activeTouches === 1) {
        const target = event.target as SVGPathElement;
        const code = target?.getAttribute?.('data-code');
        if (code) {
          pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY, target, code };
        } else {
          pointerStart = null;
        }
      } else {
        // Multi-touch (pinch zoom) — cancel tap detection
        pointerStart = null;
      }
    });
    svg.on('pointerup.tap', (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return;
      activeTouches = Math.max(0, activeTouches - 1);
      if (!pointerStart || event.pointerId !== pointerStart.id) return;
      const dx = event.clientX - pointerStart.x;
      const dy = event.clientY - pointerStart.y;
      const wasTap = dx * dx + dy * dy < TAP_THRESHOLD * TAP_THRESHOLD;
      const { target, code } = pointerStart;
      pointerStart = null;
      if (!wasTap) return;
      clearPreviousHover(code);
      const isInset = target.classList.contains('inset-region');
      // Apply hover highlight
      if (isInset) {
        target.setAttribute('stroke', COLORS.strokeHover);
        target.setAttribute('stroke-width', '2');
      } else if (!borderMesh) {
        target.setAttribute('stroke', COLORS.strokeHover);
        target.setAttribute('stroke-width', '1.5');
      }
      if (!answeredCodesRef.current.has(code) && code !== targetRegionCodeRef.current && code !== wrongFlashCodeRef.current) {
        target.setAttribute('fill', COLORS.hover);
        // Sync main map element for inset taps
        if (isInset) {
          const mainEl = svgRef.current?.querySelector(`path.region[data-code="${code}"]`) as SVGPathElement | null;
          if (mainEl) mainEl.setAttribute('fill', COLORS.hover);
        }
      }
      onRegionHoverRef.current?.(code);
      // Show label tooltip on tap (learn mode)
      if (showLabels) {
        const feature = geoData.features.find(f => getRegionCode(f) === code);
        if (feature) {
          const tooltip = g.select('.tooltip');
          if (!tooltip.empty()) {
            const k = zoomTransformRef.current.k;
            const centroid = path.centroid(feature as GeoPermissibleObjects);
            tooltip.selectAll('*').remove();
            tooltip.append('text')
              .attr('x', centroid[0]).attr('y', centroid[1])
              .attr('text-anchor', 'middle').attr('dy', '-0.5em')
              .attr('font-size', `${13 / k}px`).attr('font-weight', '600')
              .attr('fill', '#1f2937')
              .attr('stroke', 'white').attr('stroke-width', 3 / k)
              .attr('paint-order', 'stroke')
              .text(getDisplayName(feature, locale));
          }
        }
      }
    });
    svg.on('pointercancel.tap', (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return;
      activeTouches = Math.max(0, activeTouches - 1);
      if (pointerStart?.id === event.pointerId) pointerStart = null;
    });

    // Track active hover for touch devices (no pointerleave on touch)
    let activeHoverCode: string | null = null;
    const clearPreviousHover = (newCode: string | null) => {
      if (activeHoverCode && activeHoverCode !== newCode) {
        const prevEls = elIndex.get(activeHoverCode);
        if (prevEls) {
          for (const el of prevEls) {
            if (el.classList.contains('inset-region')) {
              el.setAttribute('stroke', COLORS.stroke);
              el.setAttribute('stroke-width', '1.5');
            } else if (displayMode === 'borderless') {
              // Keep stroke matching fill to avoid seams
              const code = el.getAttribute('data-code') || '';
              el.setAttribute('stroke', answeredCodesRef.current.has(code) ? getAnsweredFill(answeredCodesRef.current, code) : 'transparent');
              el.setAttribute('stroke-width', '1');
            } else {
              el.setAttribute('stroke', borderMesh ? 'none' : COLORS.stroke);
              el.setAttribute('stroke-width', borderMesh ? '0' : '1.2');
            }
            const code = activeHoverCode!;
            if (code === wrongFlashCodeRef.current) continue;
            if (answeredCodesRef.current.has(code)) {
              el.setAttribute('fill', getAnsweredFill(answeredCodesRef.current, code));
            } else if (code === targetRegionCodeRef.current) {
              el.setAttribute('fill', COLORS.target);
            } else if (displayMode === 'borderless' && el.classList.contains('region')) {
              el.setAttribute('fill', 'transparent');
            } else {
              el.setAttribute('fill', COLORS.unanswered);
            }
          }
        }
        onRegionHoverRef.current?.(null);
      }
      activeHoverCode = newCode;
      activeHoverCodeRef.current = newCode;
    };

    const { effectiveInsets, mainWidth, mainHeight, boxes } =
      computeInsetLayout(width, height, activeInsetZones);

    // Nested SVG clips main map content; zoom is on parent SVG
    const mainSvg = svg.append('svg')
      .attr('width', mainWidth)
      .attr('height', mainHeight)
      .attr('overflow', 'hidden');
    const g = mainSvg.append('g');

    // Apply stored zoom transform and set up zoom behavior
    g.attr('transform', zoomTransformRef.current.toString());
    let miniProj: GeoProjection | null = null;

    function updateMinimapViewport(transform: ZoomTransform) {
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

    const zoom = d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 6])
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
    if (zoomTransformRef.current !== zoomIdentity) {
      svg.call(zoom.transform, zoomTransformRef.current);
    }
    const projection = geoMercator();

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

        const path = geoPath().projection(projection);

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

    const path = geoPath().projection(projection);

    // Context layer: surrounding regions in gray for geographic context (not in borderless)
    if (contextGeoData && displayMode !== 'borderless') {
      g.selectAll('path.context')
        .data(contextGeoData.features)
        .join('path')
        .attr('class', 'context')
        .attr('d', pathAttr(path))
        .attr('fill', '#f3f4f6')
        .attr('stroke', '#d1d5db')
        .attr('stroke-width', 0.8)
        .style('vector-effect', 'non-scaling-stroke')
        .style('pointer-events', 'none');
    }

    // Helper: get fill color in normal style (used for main normal mode + insets)
    const unansweredFill = COLORS.unanswered;
    const getNormalFill = (d: RegionFeature): string => {
      const code = getRegionCode(d);
      if (code === wrongFlashCodeRef.current) return COLORS.wrongFlash;
      if (answeredCodesRef.current.has(code)) return getAnsweredFill(answeredCodesRef.current, code);
      if (code === targetRegionCodeRef.current) return COLORS.target;
      return unansweredFill;
    };

    if (displayMode === 'borderless') {
      // Merge active regions into a single polygon → draw only the outer boundary
      try {
        const objectKey = Object.keys(topoData.objects)[0];
        const geometries = topoData.objects[objectKey] as GeometryCollection;
        const activeCodes = new Set(geoData.features.map(f => getRegionCode(f)));

        const filtered = geometries.geometries.filter(geo => {
          const p = geo.properties as Record<string, unknown> | undefined;
          return activeCodes.has(String(p?.CTPRVN_CD ?? p?.SIG_CD ?? p?.code ?? ''));
        }) as unknown as import('topojson-specification').Polygon[];
        const merged = topojson.merge(topoData, filtered);

        g.append('path')
          .attr('d', path(merged) ?? '')
          .attr('fill', 'none')
          .attr('stroke', COLORS.outlineStroke)
          .attr('stroke-width', 0.8)
          .style('vector-effect', 'non-scaling-stroke');
      } catch {
        // Fallback: just draw without internal borders
      }

      // Invisible clickable regions (stroke matches fill to hide seams)
      g.selectAll('path.region')
        .data(geoData.features)
        .join('path')
        .attr('class', 'region')
        .attr('data-code', (d: RegionFeature) => getRegionCode(d))
        .attr('d', pathAttr(path))
        .attr('fill', (d: RegionFeature) => {
          const code = getRegionCode(d);
          if (code === wrongFlashCodeRef.current) return COLORS.wrongFlash;
          if (answeredCodesRef.current.has(code)) return getAnsweredFill(answeredCodesRef.current, code);
          return 'transparent';
        })
        .attr('stroke', (d: RegionFeature) => {
          const code = getRegionCode(d);
          if (answeredCodesRef.current.has(code)) return getAnsweredFill(answeredCodesRef.current, code);
          return 'transparent';
        })
        .attr('stroke-width', 1)
        .style('vector-effect', 'non-scaling-stroke')
        .style('cursor', 'pointer')
        .on('click', (_, d: RegionFeature) => {
          onRegionClickRef.current?.(getRegionCode(d));
        })
        .each(function (d: RegionFeature) { indexEl(getRegionCode(d), this as SVGPathElement); });
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
        .style('vector-effect', 'non-scaling-stroke')
        .style('cursor', 'pointer')
        .style('transition', 'fill 0.15s ease')
        .on('click', (_, d: RegionFeature) => {
          onRegionClickRef.current?.(getRegionCode(d));
        })
        .on('pointerenter', (event: PointerEvent, d: RegionFeature) => {
          if (event.pointerType === 'touch') return;
          const code = getRegionCode(d);
          clearPreviousHover(code);
          const el = select(event.currentTarget as Element);
          if (!hasMesh) el.attr('stroke', COLORS.strokeHover).attr('stroke-width', 1.5);
          if (!answeredCodesRef.current.has(code) && code !== targetRegionCodeRef.current && code !== wrongFlashCodeRef.current) {
            el.attr('fill', COLORS.hover);
          }
          onRegionHoverRef.current?.(getRegionCode(d));
        })
        .on('pointerleave', (event: PointerEvent, d: RegionFeature) => {
          if (event.pointerType === 'touch') return;
          const code = getRegionCode(d);
          const el = select(event.currentTarget as Element);
          if (!hasMesh) el.attr('stroke', COLORS.stroke).attr('stroke-width', 1.2);
          if (code === wrongFlashCodeRef.current) return;
          if (answeredCodesRef.current.has(code)) {
            el.attr('fill', getAnsweredFill(answeredCodesRef.current, code));
          } else if (code === targetRegionCodeRef.current) {
            el.attr('fill', COLORS.target);
          } else {
            el.attr('fill', unansweredFill);
          }
          onRegionHoverRef.current?.(null);
        })
        .each(function (d: RegionFeature) { indexEl(getRegionCode(d), this as SVGPathElement); });

      // Separate border mesh layer (sigun mode: inter-group boundaries only)
      if (borderMesh) {
        g.append('path')
          .datum(borderMesh)
          .attr('d', path(borderMesh) ?? '')
          .attr('fill', 'none')
          .attr('stroke', COLORS.stroke)
          .attr('stroke-width', 1.2)
          .style('vector-effect', 'non-scaling-stroke')
          .style('pointer-events', 'none');
      }
    }

    // Draw bbox rectangles on main map to show inset coverage areas
    if (effectiveInsets) {
      activeInsetZones.forEach((zone) => {
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
        .on('pointerenter.label', (event: PointerEvent, d: unknown) => {
          if (event.pointerType === 'touch') return;
          const feature = d as RegionFeature;
          const name = getDisplayName(feature, locale);
          const centroid = path.centroid(feature as GeoPermissibleObjects);

          const k = zoomTransformRef.current.k;
          tooltip.selectAll('*').remove();
          tooltip
            .append('text')
            .attr('x', centroid[0])
            .attr('y', centroid[1])
            .attr('text-anchor', 'middle')
            .attr('dy', '-0.5em')
            .attr('font-size', `${13 / k}px`)
            .attr('font-weight', '600')
            .attr('fill', '#1f2937')
            .attr('stroke', 'white')
            .attr('stroke-width', 3 / k)
            .attr('paint-order', 'stroke')
            .text(name);
        })
        .on('pointerleave.label', (event: PointerEvent) => {
          if (event.pointerType === 'touch') return;
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

      miniProj = geoMercator().fitExtent(
        [[miniPadding, miniPadding], [MINI_W - miniPadding, MINI_H - miniPadding]],
        geoData,
      );
      const miniPath = geoPath().projection(miniProj);

      if (displayMode === 'borderless') {
        // Borderless minimap: merged outer boundary only
        try {
          const objectKey = Object.keys(topoData.objects)[0];
          const geometries = topoData.objects[objectKey] as GeometryCollection;
          const activeCodes = new Set(geoData.features.map(f => getRegionCode(f)));
          const merged = topojson.merge(topoData, geometries.geometries.filter(geo => {
            const p = geo.properties as Record<string, unknown> | undefined;
            return activeCodes.has(String(p?.CTPRVN_CD ?? p?.SIG_CD ?? p?.code ?? ''));
          }) as unknown as import('topojson-specification').Polygon[]);
          miniG.append('path')
            .attr('d', miniPath(merged) ?? '')
            .attr('fill', '#d1d5db')
            .attr('stroke', '#9ca3af')
            .attr('stroke-width', 0.3);
        } catch {
          // Fallback: draw individual features without stroke
          miniG.selectAll('path')
            .data(geoData.features)
            .join('path')
            .attr('d', (d) => miniPath(d) ?? '')
            .attr('fill', '#d1d5db')
            .attr('stroke', 'none');
        }
      } else {
        miniG.selectAll('path')
          .data(geoData.features)
          .join('path')
          .attr('d', (d) => miniPath(d) ?? '')
          .attr('fill', '#d1d5db')
          .attr('stroke', '#9ca3af')
          .attr('stroke-width', 0.15);
      }

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

      activeInsetZones.forEach((zone, i) => {
        const zoneFeatures = zoneFeaturesMap.get(zone) || [];
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

        const insetProj = geoMercator().fitExtent(
          [
            [insetPad, insetPad],
            [boxW - insetPad, boxH - insetPad],
          ],
          bboxGeoJSON,
        );
        const insetPath = geoPath().projection(insetProj);

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
          .attr('data-code', (d: RegionFeature) => getRegionCode(d))
          .attr('d', pathAttr(insetPath))
          .attr('fill', displayMode === 'borderless' ? 'transparent' : getNormalFill)
          .attr('stroke', displayMode === 'borderless' ? 'none' : COLORS.stroke)
          .attr('stroke-width', displayMode === 'borderless' ? 0 : 1.5)
          .style('cursor', 'pointer')
          .on('click', (_, d: RegionFeature) => {
            onRegionClickRef.current?.(getRegionCode(d));
          })
          .each(function (d: RegionFeature) {
            const el = this as SVGPathElement;
            const code = getRegionCode(d);
            indexEl(code, el);
            el.addEventListener('pointerenter', (event: PointerEvent) => {
              if (event.pointerType === 'touch') return;
              clearPreviousHover(code);
              el.setAttribute('stroke', COLORS.strokeHover);
              el.setAttribute('stroke-width', '2');
              if (!answeredCodesRef.current.has(code) && code !== targetRegionCodeRef.current && code !== wrongFlashCodeRef.current) {
                el.setAttribute('fill', COLORS.hover);
              }
              const mainEl = svgRef.current?.querySelector(`path.region[data-code="${code}"]`) as SVGPathElement | null;
              if (mainEl && !answeredCodesRef.current.has(code) && code !== targetRegionCodeRef.current && code !== wrongFlashCodeRef.current) {
                mainEl.setAttribute('fill', COLORS.hover);
              }
              onRegionHoverRef.current?.(code);
            });
            el.addEventListener('pointerleave', (event: PointerEvent) => {
              if (event.pointerType === 'touch') return;
              el.setAttribute('stroke', COLORS.stroke);
              el.setAttribute('stroke-width', '1.5');
              if (code === wrongFlashCodeRef.current) return;
              if (answeredCodesRef.current.has(code)) {
                el.setAttribute('fill', getAnsweredFill(answeredCodesRef.current, code));
              } else if (code === targetRegionCodeRef.current) {
                el.setAttribute('fill', COLORS.target);
              } else {
                el.setAttribute('fill', unansweredFill);
              }
              const mainEl = svgRef.current?.querySelector(`path.region[data-code="${code}"]`) as SVGPathElement | null;
              if (mainEl) {
                if (answeredCodesRef.current.has(code)) mainEl.setAttribute('fill', getAnsweredFill(answeredCodesRef.current, code));
                else if (code === targetRegionCodeRef.current) mainEl.setAttribute('fill', COLORS.target);
                else mainEl.setAttribute('fill', unansweredFill);
              }
              onRegionHoverRef.current?.(null);
            });
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
            .on('pointerenter.label', (event: PointerEvent, d: unknown) => {
              if (event.pointerType === 'touch') return;
              const feature = d as RegionFeature;
              const name = getDisplayName(feature, locale);
              const centroid = insetPath.centroid(feature as GeoPermissibleObjects);

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
            .on('pointerleave.label', (event: PointerEvent) => {
              if (event.pointerType === 'touch') return;
              insetTooltip.selectAll('*').remove();
            });
        }
      });
    }
    regionElsRef.current = elIndex;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoData, contextGeoData, topoData, borderMesh, displayMode, width, height, activeInsetZones, zoneFeaturesMap, locale, structuralTargetCode, showLabels, resetZoom]);

  // Lightweight fill-update effect: O(1) per code via element index
  useEffect(() => {
    if (displayMode === 'outline-only') return;
    const elIndex = regionElsRef.current;
    const isBorderless = displayMode === 'borderless';

    const hovered = activeHoverCodeRef.current;
    for (const [code, els] of elIndex) {
      // Preserve touch hover highlight
      if (code === hovered && code !== wrongFlashCode && !answeredCodes.has(code)) continue;

      let fill: string;
      if (code === wrongFlashCode) fill = COLORS.wrongFlash;
      else if (answeredCodes.has(code)) fill = getAnsweredFill(answeredCodes, code);
      else if (code === targetRegionCode) fill = COLORS.target;
      else fill = COLORS.unanswered;

      for (const el of els) {
        // Borderless main-map regions stay transparent unless answered/targeted
        if (isBorderless && el.classList.contains('region') && fill !== COLORS.wrongFlash && !answeredCodes.has(code) && code !== targetRegionCode) {
          el.setAttribute('fill', 'transparent');
          el.setAttribute('stroke', 'transparent');
        } else {
          el.setAttribute('fill', fill);
          if (isBorderless && el.classList.contains('region')) {
            el.setAttribute('stroke', fill);
          }
        }
      }
    }
  }, [answeredCodes, wrongFlashCode, targetRegionCode, displayMode]);

  const computedHeight = computeSvgHeight(width, height, activeInsetZones);

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
