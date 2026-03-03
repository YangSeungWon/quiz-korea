import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { RegionCollection, RegionFeature, MapDisplayMode } from '../types';
import { getRegionCode, getDisplayName } from '../utils/regionUtils';

// Helper to avoid D3 generics mismatch on .attr('d', path)
function pathAttr(path: d3.GeoPath): (d: RegionFeature) => string {
  return (d: RegionFeature) => path(d) ?? '';
}

// Inset cities (7 metropolitan areas)
const INSET_CITIES = [
  { code: '11', label: '서울' },
  { code: '26', label: '부산' },
  { code: '27', label: '대구' },
  { code: '28', label: '인천' },
  { code: '29', label: '광주' },
  { code: '30', label: '대전' },
  { code: '31', label: '울산' },
] as const;

const INSET_COL_WIDTH = 140;

interface QuizMapProps {
  geoData: RegionCollection;
  topoData: Topology;
  displayMode: MapDisplayMode;
  width: number;
  height: number;
  showInsets?: boolean;
  targetRegionCode?: string | null;
  answeredCodes: Map<string, number>;
  wrongFlashCode: string | null;
  hoveredCode?: string | null;
  onRegionClick?: (code: string) => void;
  onRegionHover?: (code: string | null) => void;
  showLabels?: boolean;
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
  displayMode,
  width,
  height,
  showInsets = false,
  targetRegionCode,
  answeredCodes,
  wrongFlashCode,
  onRegionClick,
  onRegionHover,
  showLabels = false,
}: QuizMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !geoData) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Determine main map width (leave room for insets if needed)
    const effectiveInsets = showInsets && displayMode !== 'outline-only';
    const mainWidth = effectiveInsets ? width - INSET_COL_WIDTH : width;

    const g = svg.append('g');
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
        [mainWidth - 20, height - 20],
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
        })
        .on('mouseenter', (event: MouseEvent, d: RegionFeature) => {
          if (!answeredCodes.has(getRegionCode(d))) {
            d3.select(event.currentTarget as Element).attr('fill', COLORS.hover);
          }
          onRegionHover?.(getRegionCode(d));
        })
        .on('mouseleave', (event: MouseEvent, d: RegionFeature) => {
          const code = getRegionCode(d);
          if (code === wrongFlashCode) return;
          if (!answeredCodes.has(code)) {
            d3.select(event.currentTarget as Element).attr('fill', 'transparent');
          }
          onRegionHover?.(null);
        });
    } else {
      // Normal mode: full map with borders
      g.selectAll('path')
        .data(geoData.features)
        .join('path')
        .attr('d', pathAttr(path))
        .attr('fill', getNormalFill)
        .attr('stroke', COLORS.stroke)
        .attr('stroke-width', 0.5)
        .style('cursor', 'pointer')
        .style('transition', 'fill 0.15s ease')
        .on('click', (_, d: RegionFeature) => {
          onRegionClick?.(getRegionCode(d));
        })
        .on('mouseenter', (event: MouseEvent, d: RegionFeature) => {
          const code = getRegionCode(d);
          const el = d3.select(event.currentTarget as Element);
          el.attr('stroke', COLORS.strokeHover).attr('stroke-width', 1.5);
          if (!answeredCodes.has(code) && code !== targetRegionCode && code !== wrongFlashCode) {
            el.attr('fill', COLORS.hover);
          }
          onRegionHover?.(getRegionCode(d));
        })
        .on('mouseleave', (event: MouseEvent, d: RegionFeature) => {
          const code = getRegionCode(d);
          const el = d3.select(event.currentTarget as Element);
          el.attr('stroke', COLORS.stroke).attr('stroke-width', 0.5);
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
    }

    // Show labels on hover in learn mode
    if (showLabels) {
      const tooltip = g.append('g').attr('class', 'tooltip').style('pointer-events', 'none');

      g.selectAll('path.region, path:not(.region)')
        .on('mouseenter.label', (_event: MouseEvent, d: unknown) => {
          const feature = d as RegionFeature;
          const name = getDisplayName(feature);
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
      const insetBoxHeight = height / INSET_CITIES.length;
      const insetPad = 3;
      const labelH = 14;

      INSET_CITIES.forEach((city, i) => {
        const cityFeatures = geoData.features.filter((f) =>
          getRegionCode(f).startsWith(city.code),
        );
        if (cityFeatures.length === 0) return;

        const x = mainWidth;
        const y = i * insetBoxHeight;
        const boxW = INSET_COL_WIDTH;
        const boxH = insetBoxHeight;

        const insetG = svg.append('g').attr('transform', `translate(${x},${y})`);

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
          .attr('font-size', '10px')
          .attr('font-weight', '600')
          .attr('fill', '#374151')
          .text(city.label);

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
              const name = getDisplayName(feature);
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
  }, [geoData, topoData, displayMode, width, height, showInsets, targetRegionCode, answeredCodes, wrongFlashCode, onRegionClick, onRegionHover, showLabels]);

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="block mx-auto"
    />
  );
}
