// Draws a shareable result card to a PNG blob using canvas (no dependencies).
// Includes a snapshot of the actual quiz result map (regions colored by how
// they were answered) alongside the score/time stats.

export interface ResultCardData {
  /** Brand line, e.g. "한국 지리 퀴즈 🇰🇷" */
  title: string;
  /** Mode/region/options line, e.g. "클릭 퀴즈 · 수원시 시군구 15" */
  modeLine: string;
  /** Score, e.g. "12/15" */
  score: string;
  /** Elapsed time, e.g. "02:34" */
  time: string;
  /** Site URL line, e.g. "quiz-korea.ysw.kr" */
  url: string;
  /** New-record badge text, omit when not a new best. */
  newRecord?: string;
  /** Snapshot of the result map (already-rendered SVG). Omit to skip the map. */
  mapImage?: HTMLImageElement | null;
}

const FONT = 'ui-sans-serif, system-ui, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif';

/**
 * Serialize the on-screen quiz map SVG into an Image so it can be composited
 * onto the canvas. Returns null if no map is present or it can't be loaded.
 */
export async function captureMapImage(): Promise<HTMLImageElement | null> {
  const svg = document.querySelector<SVGSVGElement>('svg[data-quiz-map]');
  if (!svg) return null;
  try {
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    const xml = new XMLSerializer().serializeToString(clone);
    const src = 'data:image/svg+xml;base64,' + window.btoa(unescape(encodeURIComponent(xml)));
    const img = new Image();
    img.width = svg.clientWidth || svg.width.baseVal.value;
    img.height = svg.clientHeight || svg.height.baseVal.value;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('map image load failed'));
      img.src = src;
    });
    return img;
  } catch {
    return null;
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export async function buildResultCard(d: ResultCardData): Promise<Blob> {
  const W = 1200;
  const H = 630;
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');
  ctx.scale(scale, scale);

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#eef2ff');
  bg.addColorStop(1, '#ffffff');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Blue accent bar at top
  ctx.fillStyle = '#2563eb';
  ctx.fillRect(0, 0, W, 12);

  const hasMap = !!d.mapImage && d.mapImage.width > 0 && d.mapImage.height > 0;

  // Left map panel + right text column when a map is available; otherwise
  // fall back to a centered stats-only layout.
  const mapPanel = { x: 40, y: 44, w: 600, h: 542 };
  const tx = hasMap ? 688 : 80;
  const trx = hasMap ? 1160 : W - 80;
  const tcx = (tx + trx) / 2;

  if (hasMap) {
    // Map backdrop
    ctx.fillStyle = '#f8fafc';
    roundRect(ctx, mapPanel.x, mapPanel.y, mapPanel.w, mapPanel.h, 20);
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;
    roundRect(ctx, mapPanel.x, mapPanel.y, mapPanel.w, mapPanel.h, 20);
    ctx.stroke();

    // Contain-fit the map within the panel (with inner padding)
    const pad = 18;
    const innerW = mapPanel.w - pad * 2;
    const innerH = mapPanel.h - pad * 2;
    const img = d.mapImage!;
    const ar = img.width / img.height;
    let dw = innerW;
    let dh = innerW / ar;
    if (dh > innerH) {
      dh = innerH;
      dw = innerH * ar;
    }
    const dx = mapPanel.x + pad + (innerW - dw) / 2;
    const dy = mapPanel.y + pad + (innerH - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  // Title
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#1e293b';
  ctx.font = `bold 40px ${FONT}`;
  ctx.fillText(d.title, tx, 96);

  // Mode line
  ctx.fillStyle = '#64748b';
  ctx.font = `24px ${FONT}`;
  ctx.fillText(d.modeLine, tx, 138);

  // Big score (centered in text column)
  ctx.textAlign = 'center';
  ctx.fillStyle = '#2563eb';
  ctx.font = `bold ${hasMap ? 148 : 184}px ${FONT}`;
  ctx.fillText(d.score, tcx, hasMap ? 348 : 400);

  // New-record badge (centered, under the score)
  if (d.newRecord) {
    ctx.font = `bold 26px ${FONT}`;
    const tw = ctx.measureText(d.newRecord).width;
    const bw = tw + 40;
    const bh = 48;
    const bx = tcx - bw / 2;
    const by = hasMap ? 404 : 456;
    ctx.fillStyle = '#fef3c7';
    roundRect(ctx, bx, by, bw, bh, 24);
    ctx.fill();
    ctx.fillStyle = '#b45309';
    ctx.fillText(d.newRecord, tcx, by + 33);
  }

  // Bottom row: clock icon + time (left of text column), url (right)
  const clockR = 20;
  const clockCx = tx + clockR;
  const clockCy = H - 72;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(clockCx, clockCy, clockR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(clockCx, clockCy);
  ctx.lineTo(clockCx, clockCy - clockR * 0.55);
  ctx.moveTo(clockCx, clockCy);
  ctx.lineTo(clockCx + clockR * 0.42, clockCy + clockR * 0.1);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#0f172a';
  ctx.font = `bold 44px ${FONT}`;
  ctx.fillText(d.time, clockCx + clockR + 16, clockCy + 2);

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#94a3b8';
  ctx.font = `26px ${FONT}`;
  ctx.fillText(d.url, trx, H - 50);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob returned null'))),
      'image/png',
    );
  });
}
