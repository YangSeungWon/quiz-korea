import type { Selection } from 'd3-selection';
import type { RegionFeature } from '../types';

type Ring = [number, number][];
type Poly = Ring[]; // [outer, ...holes]

function segDistSq(px: number, py: number, a: [number, number], b: [number, number]): number {
  let x = a[0], y = a[1];
  let dx = b[0] - x, dy = b[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((px - x) * dx + (py - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) { x = b[0]; y = b[1]; }
    else if (t > 0) { x += dx * t; y += dy * t; }
  }
  dx = px - x; dy = py - y;
  return dx * dx + dy * dy;
}

// Signed distance from (x,y) to the polygon boundary (positive inside).
function pointToPolyDist(x: number, y: number, poly: Poly): number {
  let inside = false;
  let minSq = Infinity;
  for (const ring of poly) {
    for (let i = 0, len = ring.length, j = len - 1; i < len; j = i++) {
      const a = ring[i], b = ring[j];
      if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
      minSq = Math.min(minSq, segDistSq(x, y, a, b));
    }
  }
  return (inside ? 1 : -1) * Math.sqrt(minSq);
}

interface Cell { x: number; y: number; h: number; d: number; max: number }

/**
 * Pole of inaccessibility — the interior point farthest from any edge (mapbox's
 * polylabel algorithm, ported). Places labels in the visual center of the widest
 * open part of a region, avoiding pinched waists (대구) and holes (경기 wrapping 서울).
 */
function polylabel(poly: Poly, precision = 1.5): [number, number] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of poly[0]) {
    if (x < minX) minX = x; if (y < minY) minY = y;
    if (x > maxX) maxX = x; if (y > maxY) maxY = y;
  }
  const width = maxX - minX, height = maxY - minY;
  const cellSize = Math.min(width, height);
  if (cellSize === 0) return [minX, minY];
  const h0 = cellSize / 2;

  const makeCell = (x: number, y: number, h: number): Cell => {
    const d = pointToPolyDist(x, y, poly);
    return { x, y, h, d, max: d + h * Math.SQRT2 };
  };

  // Max-heap keyed by cell.max.
  const heap: Cell[] = [];
  const push = (c: Cell) => {
    heap.push(c);
    let i = heap.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (heap[p].max >= heap[i].max) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
  };
  const pop = (): Cell => {
    const top = heap[0]; const last = heap.pop() as Cell;
    if (heap.length) {
      heap[0] = last; let i = 0; const n = heap.length;
      for (;;) { let m = i; const l = 2 * i + 1, r = l + 1; if (l < n && heap[l].max > heap[m].max) m = l; if (r < n && heap[r].max > heap[m].max) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; }
    }
    return top;
  };

  for (let x = minX; x < maxX; x += cellSize)
    for (let y = minY; y < maxY; y += cellSize)
      push(makeCell(x + h0, y + h0, h0));

  let best = makeCell(minX + width / 2, minY + height / 2, 0);
  while (heap.length) {
    const cell = pop();
    if (cell.d > best.d) best = cell;
    if (cell.max - best.d <= precision) continue;
    const nh = cell.h / 2;
    push(makeCell(cell.x - nh, cell.y - nh, nh));
    push(makeCell(cell.x + nh, cell.y - nh, nh));
    push(makeCell(cell.x - nh, cell.y + nh, nh));
    push(makeCell(cell.x + nh, cell.y + nh, nh));
  }
  return [best.x, best.y];
}

/**
 * Best label anchor for a feature in projected/screen space: the pole of
 * inaccessibility of its largest polygon. Returns null if it can't be computed
 * (caller should fall back to path.centroid).
 */
export function labelAnchor(
  feature: RegionFeature,
  project: (p: [number, number]) => [number, number] | null,
): [number, number] | null {
  const g = feature.geometry as { type: string; coordinates: unknown };
  const polys: number[][][][] =
    g.type === 'Polygon' ? [g.coordinates as number[][][]]
    : g.type === 'MultiPolygon' ? (g.coordinates as number[][][][])
    : [];
  if (polys.length === 0) return null;
  // Largest polygon by |shoelace| of the outer ring (lon/lat is fine for ranking).
  let best: number[][][] | null = null;
  let bestArea = -1;
  for (const poly of polys) {
    const outer = poly[0];
    let a = 0;
    for (let i = 0, j = outer.length - 1; i < outer.length; j = i++) a += (outer[j][0] - outer[i][0]) * (outer[j][1] + outer[i][1]);
    a = Math.abs(a);
    if (a > bestArea) { bestArea = a; best = poly; }
  }
  if (!best) return null;
  const projected: Poly = [];
  for (const ring of best) {
    const pr: Ring = [];
    for (const c of ring) { const p = project(c as [number, number]); if (p) pr.push([p[0], p[1]]); }
    if (pr.length >= 3) projected.push(pr);
  }
  if (projected.length === 0 || projected[0].length < 3) return null;
  return polylabel(projected);
}

/**
 * Collision-aware static-label placement for the printable maps.
 *
 * Labels are area-driven: bigger regions get a bigger target size. To keep them
 * legible *and* non-overlapping, we place the largest/most-important labels first
 * and shrink each subsequent label (1px at a time, down to `floor`) until its
 * measured bounding box clears everything already placed. Nothing is hidden — a
 * label that still overlaps at the floor is kept (only happens in the densest
 * historic 자치구 clusters, which are mostly pulled into zoom insets anyway).
 *
 * Requires a live (rendered, DOM-attached) SVG so `getBBox()` returns real
 * metrics — always true for the puppeteer-rendered print routes.
 */

type LabelSelection = Selection<SVGSVGElement | SVGGElement, unknown, null, undefined>;

export interface LabelItem {
  x: number;
  y: number;
  /** One entry per line (compound Korean names split on spaces render as 2 lines). */
  lines: string[];
  /** Desired font size before any collision shrink. */
  targetSize: number;
  /** Higher = placed first, so it keeps its size; crowded neighbors shrink around it. */
  priority: number;
  fill: string;
}

interface Rect { x: number; y: number; w: number; h: number }

export function placeLabels(
  container: LabelSelection,
  items: LabelItem[],
  opts: { floor: number; pad?: number; fontWeight?: number | string },
): void {
  const pad = opts.pad ?? 2;
  const weight = opts.fontWeight ?? 600;
  const placed: Rect[] = [];

  const overlaps = (b: { x: number; y: number; width: number; height: number }) =>
    placed.some(
      (p) =>
        b.x < p.x + p.w + pad &&
        b.x + b.width + pad > p.x &&
        b.y < p.y + p.h + pad &&
        b.y + b.height + pad > p.y,
    );

  // Largest/most-important first.
  const ordered = [...items].sort((a, b) => b.priority - a.priority);
  for (const it of ordered) {
    if (it.lines.length === 0) continue;
    const text = container
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-weight', weight)
      .attr('fill', it.fill)
      .attr('stroke', '#ffffff')
      .attr('paint-order', 'stroke');

    const n = it.lines.length;
    const render = (fs: number) => {
      text.selectAll('*').remove();
      text.attr('font-size', fs).attr('stroke-width', Math.max(1.2, fs * 0.2));
      it.lines.forEach((line, i) => {
        text
          .append('tspan')
          .attr('x', it.x)
          .attr('y', it.y)
          .attr('dy', `${(i - (n - 1) / 2) * 1.05}em`)
          .text(line);
      });
    };

    let fs = it.targetSize;
    render(fs);
    let bb = (text.node() as SVGGraphicsElement).getBBox();
    while (fs > opts.floor && overlaps(bb)) {
      fs -= 1;
      render(fs);
      bb = (text.node() as SVGGraphicsElement).getBBox();
    }
    // Keep even if it still overlaps at the floor (never hide).
    placed.push({ x: bb.x, y: bb.y, w: bb.width, h: bb.height });
  }
}
