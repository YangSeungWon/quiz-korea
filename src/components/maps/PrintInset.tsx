import { useEffect, useRef } from 'react';
import { select } from 'd3-selection';
import { geoMercator, geoPath } from 'd3-geo';
import type { GeoPermissibleObjects } from 'd3-geo';
import { getShortDisplayName, getCompactDisplayName } from '../../utils/regionUtils';
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
  compact?: boolean; // strip 시/군/특별시/도 suffix — used at sigun level
  fontRange?: readonly [number, number];
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
  compact = false,
  fontRange,
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
      .attr('stroke', '#9ca3af')
      .attr('stroke-width', 0.8)
      .attr('stroke-dasharray', '3,2');

    // Inset label
    svg
      .append('text')
      .attr('x', 8)
      .attr('y', 12)
      .attr('font-size', 9)
      .attr('font-weight', 600)
      .attr('fill', '#6b7280')
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

    features.forEach((f) => {
      regionGroup
        .append('path')
        .datum(f)
        .attr('d', path(f as GeoPermissibleObjects) ?? '')
        .attr('fill', '#e5e7eb')
        .attr('stroke', '#9ca3af')
        .attr('stroke-width', 0.6);
    });

    if (showLabels) {
      // Dynamic label sizing based on path area within this projection
      const areas = features.map((f) => Math.abs(path.area(f as GeoPermissibleObjects)));
      const positive = areas.filter((a) => a > 0);
      const minA = positive.length > 0 ? Math.min(...positive) : 1;
      const maxA = positive.length > 0 ? Math.max(...positive) : 1;
      const lo = Math.log(Math.max(minA, 1));
      const hi = Math.log(Math.max(maxA, 1));
      const [fMin, fMax] = fontRange ?? [6, 10];
      const fontSizeFor = (area: number) => {
        if (hi <= lo) return Math.round((fMin + fMax) / 2);
        const v = Math.log(Math.max(area, 1));
        const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
        return Math.round(fMin + t * (fMax - fMin));
      };

      features.forEach((f, i) => {
        const c = path.centroid(f as GeoPermissibleObjects);
        if (!Number.isFinite(c[0]) || !Number.isFinite(c[1])) return;
        const fontSize = fontSizeFor(areas[i]);
        const fullName = compact ? getCompactDisplayName(f, locale) : getShortDisplayName(f, locale);
        // Multi-line for compound 시군구 names like "고양시 일산서구" → 2 lines
        const parts = locale === 'ko' && fullName.includes(' ') ? fullName.split(' ') : [fullName];
        const lineH = fontSize * 1.0;
        const totalH = parts.length * lineH;
        parts.forEach((line, li) => {
          svg
            .append('text')
            .attr('x', c[0])
            .attr('y', c[1] - totalH / 2 + lineH * (li + 0.5))
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('font-size', fontSize)
            .attr('font-weight', 600)
            .attr('fill', '#1f2937')
            .attr('stroke', '#ffffff')
            .attr('stroke-width', Math.max(1.5, fontSize * 0.22))
            .attr('paint-order', 'stroke')
            .text(line);
        });
      });
    }
  }, [features, label, width, height, showLabels, locale, bbox]);

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
