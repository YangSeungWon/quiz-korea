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

interface PlacedLabel {
  fs: number;
  target: number;
  cx: number;
  cy: number;
  w0: number; // bbox width at target size
  h0: number;
  setSize: (fs: number) => void;
}

export function placeLabels(
  container: LabelSelection,
  items: LabelItem[],
  opts: { floor: number; pad?: number; fontWeight?: number | string },
): void {
  const pad = opts.pad ?? 2;
  const weight = opts.fontWeight ?? 600;
  const floor = opts.floor;

  // Create every label at its target size; measure bbox ONCE (getBBox is costly
  // across 600+ print renders). tspan dy is in em, so shrinking is just a
  // font-size change and the bbox scales analytically — no further getBBox.
  const labels: PlacedLabel[] = [];
  for (const it of items) {
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
    it.lines.forEach((line, i) => {
      text
        .append('tspan')
        .attr('x', it.x)
        .attr('y', it.y)
        .attr('dy', `${(i - (n - 1) / 2) * 1.05}em`)
        .text(line);
    });
    const setSize = (fs: number) => text.attr('font-size', fs).attr('stroke-width', Math.max(1.2, fs * 0.2));
    setSize(it.targetSize);
    const g = (text.node() as SVGGraphicsElement).getBBox();
    labels.push({
      fs: it.targetSize,
      target: it.targetSize,
      cx: g.x + g.width / 2,
      cy: g.y + g.height / 2,
      w0: g.width,
      h0: g.height,
      setSize,
    });
  }

  const bbox = (l: PlacedLabel): Rect => {
    const s = l.fs / l.target;
    const w = l.w0 * s;
    const h = l.h0 * s;
    return { x: l.cx - w / 2, y: l.cy - h / 2, w, h };
  };
  const overlap = (a: Rect, b: Rect) =>
    a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;

  // Relaxation: each round, for every overlapping pair shrink the LARGER label
  // (both if equal), down to the floor. Big labels give way to small neighbors
  // instead of crushing them, so sizes converge and even out — no more a huge
  // region next to a tiny one, and small enclosed regions keep a readable size.
  const rects = labels.map(bbox);
  const MAX_ROUNDS = 48;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const shrink = new Set<number>();
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) {
        if (!overlap(rects[i], rects[j])) continue;
        const bigI = labels[i].fs >= labels[j].fs ? i : j;
        const smallI = labels[i].fs >= labels[j].fs ? j : i;
        if (labels[bigI].fs > floor) shrink.add(bigI);
        else if (labels[smallI].fs > floor) shrink.add(smallI);
        if (labels[i].fs === labels[j].fs && labels[smallI].fs > floor) shrink.add(smallI);
      }
    }
    if (shrink.size === 0) break;
    for (const i of shrink) {
      labels[i].fs -= 1;
      labels[i].setSize(labels[i].fs);
      rects[i] = bbox(labels[i]);
    }
  }
}
