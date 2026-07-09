import { useEffect, useRef } from 'react';
import { select } from 'd3-selection';
import { geoMercator, geoPath } from 'd3-geo';
import type { GeoPermissibleObjects } from 'd3-geo';
import { getShortDisplayName, getCompactDisplayName, getRegionCode } from '../../utils/regionUtils';
import { placeLabels, type LabelItem } from '../../utils/labelPlacement';
import type { RegionFeature, Locale } from '../../types';

interface Props {
  features: RegionFeature[];
  label: string;
  showLabels: boolean;
  locale: Locale;
  x: number;
  y: number;
  width: number;
  height: number;
  /**
   * Optional bbox [minLon, minLat, maxLon, maxLat]. When provided the projection
   * fits this exact rectangle (not the features' bbox) and rendering is clipped
   * to it — same approach as the main service insets, so features extending
   * beyond the bbox (e.g. 김포시 reaching west) don't waste inset space.
   * Without bbox, the projection auto-fits to the features themselves (used for
   * outlier insets like 동해/서해 where every island should be visible).
   */
  bbox?: readonly [number, number, number, number];
  /** Neighboring regions that straddle the bbox: drawn (clipped) for geographic
   *  context so the zoom has no gaps, but NOT labeled (they belong to the main map). */
  contextFeatures?: RegionFeature[];
  compact?: boolean; // strip 시/군/특별시/도 suffix — used at sigun level
  fontRange?: readonly [number, number];
  /** 'name' (default) draws region names; 'number' draws the shared sequential
   *  number from the `numbers` map (번호형 학습지 variant). */
  mode?: 'name' | 'number';
  numbers?: Map<string, number>;
  /** Low-toner print style: no region fill, black strokes/labels. */
  monochrome?: boolean;
}

export default function PrintInset({
  features,
  label,
  showLabels,
  locale,
  x,
  y,
  width,
  height,
  bbox,
  contextFeatures,
  compact = false,
  fontRange,
  mode = 'name',
  numbers,
  monochrome = false,
}: Props) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current || features.length === 0) return;

    const labelBarH = 18;
    const padX = 6;

    let projection;
    let clipPathId: string | null = null;
    if (bbox) {
      const [minLon, minLat, maxLon, maxLat] = bbox;
      const bboxFeature = {
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'Polygon' as const,
          coordinates: [[[minLon, minLat], [minLon, maxLat], [maxLon, maxLat], [maxLon, minLat], [minLon, minLat]]],
        },
      };
      projection = geoMercator().fitExtent(
        [
          [padX, labelBarH],
          [width - padX, height - padX],
        ],
        bboxFeature as GeoPermissibleObjects,
      );
      clipPathId = `print-inset-clip-${Math.random().toString(36).slice(2, 9)}`;
    } else {
      projection = geoMercator().fitExtent(
        [
          [padX, labelBarH],
          [width - padX, height - padX],
        ],
        { type: 'FeatureCollection', features } as GeoPermissibleObjects,
      );
    }
    const path = geoPath(projection);
    const svg = select(ref.current);
    svg.selectAll('*').remove();

    // Background + dashed border
    svg
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', width)
      .attr('height', height)
      .attr('fill', '#ffffff')
      .attr('stroke', monochrome ? '#000000' : '#9ca3af')
      .attr('stroke-width', 0.8)
      .attr('stroke-dasharray', '3,2');

    // Inset label
    svg
      .append('text')
      .attr('x', 8)
      .attr('y', 12)
      .attr('font-size', 9)
      .attr('font-weight', 600)
      .attr('fill', monochrome ? '#000000' : '#6b7280')
      .text(label);

    // Clip group when bbox-bound — clips features to exact rectangle
    let regionGroup = svg as unknown as ReturnType<typeof svg.append>;
    if (clipPathId && bbox) {
      const [minLon, minLat, maxLon, maxLat] = bbox;
      const tl = projection([minLon, maxLat])!;
      const br = projection([maxLon, minLat])!;
      svg
        .append('defs')
        .append('clipPath')
        .attr('id', clipPathId)
        .append('rect')
        .attr('x', tl[0])
        .attr('y', tl[1])
        .attr('width', br[0] - tl[0])
        .attr('height', br[1] - tl[1]);
      regionGroup = svg.append('g').attr('clip-path', `url(#${clipPathId})`) as unknown as typeof regionGroup;
    }

    // Straddling neighbors (context) drawn first and recede; the inset's own
    // regions on top, popping. In monochrome the own regions are opaque white
    // over gray context so target vs context stays distinguishable.
    (contextFeatures ?? []).forEach((f) => {
      regionGroup
        .append('path')
        .datum(f)
        .attr('d', path(f as GeoPermissibleObjects) ?? '')
        .attr('fill', monochrome ? 'none' : '#f3f4f6')
        .attr('stroke', monochrome ? '#9ca3af' : '#d1d5db')
        .attr('stroke-width', 0.6);
    });
    features.forEach((f) => {
      regionGroup
        .append('path')
        .datum(f)
        .attr('d', path(f as GeoPermissibleObjects) ?? '')
        .attr('fill', monochrome ? 'none' : '#e5e7eb')
        .attr('stroke', monochrome ? '#000000' : '#9ca3af')
        .attr('stroke-width', 0.6);
    });

    const isNumber = mode === 'number';

    if (isNumber || showLabels) {
      // Uniform target size; placeLabels() shrinks only where regions crowd.
      const areas = features.map((f) => Math.abs(path.area(f as GeoPermissibleObjects)));
      const [, fMax] = fontRange ?? (isNumber ? [10, 15] : [8, 13]);
      const fill = monochrome ? '#000000' : '#1f2937';
      const items: LabelItem[] = [];
      features.forEach((f, i) => {
        // Centroid (not pole-of-inaccessibility) inside insets: the inset <svg>
        // clips to its viewport, and a pole can land outside the bbox for a
        // feature that extends past it, hiding the label.
        const c = path.centroid(f as GeoPermissibleObjects) as [number, number];
        if (!Number.isFinite(c[0]) || !Number.isFinite(c[1])) return;
        // Clamp into the inset so a straddler (e.g. 인천, centroid west of the
        // bbox) still gets a visible label instead of being clipped away.
        const anchor: [number, number] = [
          Math.min(Math.max(c[0], padX + 8), width - padX - 8),
          Math.min(Math.max(c[1], labelBarH + 8), height - padX - 8),
        ];
        let lines: string[];
        if (isNumber) {
          const num = numbers?.get(getRegionCode(f));
          if (num === undefined) return;
          lines = [String(num)];
        } else {
          const fullName = compact ? getCompactDisplayName(f, locale) : getShortDisplayName(f, locale);
          lines = locale === 'ko' && fullName.includes(' ') ? fullName.split(' ') : [fullName];
        }
        items.push({ x: anchor[0], y: anchor[1], lines, targetSize: fMax, priority: areas[i], fill });
      });
      placeLabels(svg as unknown as Parameters<typeof placeLabels>[0], items, { floor: 5, pad: 1.5 });
    }
  }, [features, contextFeatures, label, width, height, showLabels, locale, bbox, mode, numbers, monochrome, compact, fontRange]);

  if (features.length === 0) return null;

  return (
    <svg
      ref={ref}
      width={width}
      height={height}
      style={{ position: 'absolute', left: x, top: y }}
    />
  );
}
