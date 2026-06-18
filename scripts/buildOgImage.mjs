/**
 * Generate public/og-image.png (1200×630): Korea map on the left, large title
 * + subtitle on the right. Re-run after changing the copy/layout:
 *   node scripts/buildOgImage.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { feature, mesh } from 'topojson-client';
import { geoMercator, geoPath } from 'd3-geo';
import puppeteer from 'puppeteer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const W = 1200;
const H = 630;
const TITLE = '한국 지리 퀴즈';
const SUBTITLE = '시도·시군구·읍면동을 지도에서 찾아보세요';

const topo = JSON.parse(await readFile(join(root, 'public/data/korea-sido.json'), 'utf-8'));
const objKey = Object.keys(topo.objects)[0];
const fc = feature(topo, topo.objects[objKey]);
const borders = mesh(topo, topo.objects[objKey]);

// Left map box (bigger). Korea is tall, so a tall box makes it large.
const proj = geoMercator().fitExtent([[28, 24], [430, H - 24]], fc);
const path = geoPath(proj);
const fillD = fc.features.map((f) => path(f)).filter(Boolean).join(' ');
const borderD = path(borders);

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: ${W}px; height: ${H}px; overflow: hidden;
         font-family: 'Noto Sans CJK KR', sans-serif; }
  .bg { width: ${W}px; height: ${H}px; position: relative;
        background: linear-gradient(135deg, #4f86f7 0%, #2563eb 100%); }
  .txt { position: absolute; left: 448px; top: 0; width: ${W - 448 - 40}px; height: ${H}px;
         display: flex; flex-direction: column; justify-content: center; }
  .title { color: #fff; font-weight: 900; font-size: 104px; line-height: 1.05; letter-spacing: -3px; }
  .sub { color: rgba(255,255,255,0.94); font-weight: 700; font-size: 35px; line-height: 1.3;
         margin-top: 28px; white-space: nowrap; letter-spacing: -1px; }
</style></head><body>
  <div class="bg">
    <svg width="${W}" height="${H}" style="position:absolute;inset:0">
      <path d="${fillD}" fill="rgba(255,255,255,0.97)" />
      <path d="${borderD}" fill="none" stroke="rgba(37,99,235,0.45)" stroke-width="1.4" stroke-linejoin="round" />
    </svg>
    <div class="txt">
      <div class="title">${TITLE}</div>
      <div class="sub">${SUBTITLE}</div>
    </div>
  </div>
</body></html>`;

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
const buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: W, height: H } });
await writeFile(join(root, 'public/og-image.png'), buf);
await browser.close();
console.log('Wrote public/og-image.png');
