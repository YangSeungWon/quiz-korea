/**
 * Post-build pre-rendering + PDF generation script.
 *
 * Phase 1: spin up a static server for dist/, use Puppeteer to visit each SPA
 * route and save fully-rendered HTML so search engines see real content with
 * unique title/canonical/description per filtered variant.
 *
 * Phase 2: visit /maps/print/* routes and capture each as an A4 landscape PDF
 * via page.pdf(). Two variants per page: blank (no labels) and label.
 * Output: dist/downloads/{level}[-{sido}]-{variant}.pdf
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import {
  LOCALES,
  QUIZ_MODES,
  LEVELS,
  METRO_SLUGS,
  PROVINCE_SLUGS,
  loadDongScopeCodes,
} from './regionSlugs.mjs';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const DOWNLOADS = join(DIST, 'downloads');
const PORT = 45678;

// Measured sweet spot for HTML pre-render. 1 → ~970ms/page, 2 → ~480, 3 → ~380
// with zero retries; at 4+ pages start losing navigations to ERR_ABORTED and the
// retry cost wipes out the gain (~960ms/page). Note this is the opposite of the
// PDF phase below, which must stay serial — HTML render is cheap, PDF capture
// starves itself on GPU/CDP contention.
const HTML_CONCURRENCY = 3;

function buildLanglessPaths(dongCodes) {
  const paths = ['/'];
  for (const mode of QUIZ_MODES) {
    for (const level of LEVELS) paths.push(`/quiz/${mode}/${level}`);
    for (const slug of METRO_SLUGS) paths.push(`/quiz/${mode}/sigungu/${slug}`);
    for (const slug of PROVINCE_SLUGS) paths.push(`/quiz/${mode}/sigun/${slug}`);
  }
  for (const level of LEVELS) paths.push(`/learn/${level}`);
  for (const slug of METRO_SLUGS) paths.push(`/learn/sigungu/${slug}`);
  for (const slug of PROVINCE_SLUGS) paths.push(`/learn/sigun/${slug}`);
  // Maps download pages (HTML). 전국 sigungu 백지도는 dense해서 제외.
  paths.push('/maps/sido', '/maps/sigun');
  for (const slug of METRO_SLUGS) paths.push(`/maps/sigungu/${slug}`);
  for (const slug of PROVINCE_SLUGS) paths.push(`/maps/sigun/${slug}`);
  for (const slug of PROVINCE_SLUGS) paths.push(`/maps/sigungu/${slug}`);
  // 읍면동 quiz/learn pages, one per 시군구 / 시-전체 code. These are the bulk of
  // the sitemap (1584 of 1754 URLs) and were the whole reason it was mostly 404.
  for (const code of dongCodes) {
    for (const mode of QUIZ_MODES) paths.push(`/quiz/${mode}/dong/${code}`);
    paths.push(`/learn/dong/${code}`);
  }
  // Records is linked from the landing header and the results screen. Without
  // an emitted file GitHub Pages answers a direct hit with 404.html — browsers
  // recover via the SPA fallback, but crawlers and link previews see the 404.
  paths.push('/records');
  return paths;
}

function buildHtmlRoutes(dongCodes) {
  const langless = buildLanglessPaths(dongCodes);
  const routes = [];
  for (const locale of LOCALES) {
    for (const path of langless) {
      routes.push(path === '/' ? `/${locale}` : `/${locale}${path}`);
    }
  }
  return routes;
}

function buildPdfTargets() {
  const targets = [];
  const variants = ['blank', 'label', 'number'];
  const colors = ['color', 'bw'];
  const orients = ['portrait', 'landscape'];
  // Region targets (level + optional sido slug) defined once, then crossed with
  // every variant × color × orientation.
  const regions = [
    { level: 'sido' },
    { level: 'sigun' },
    ...METRO_SLUGS.map((slug) => ({ level: 'sigungu', slug })),
    ...PROVINCE_SLUGS.map((slug) => ({ level: 'sigun', slug })),
    ...PROVINCE_SLUGS.map((slug) => ({ level: 'sigungu', slug })),
  ];
  for (const lang of LOCALES) {
    for (const variant of variants) {
      for (const color of colors) {
        for (const orient of orients) {
          const bw = color === 'bw';
          const landscape = orient === 'landscape';
          const query = [];
          if (bw) query.push('bw=1');
          if (landscape) query.push('orient=landscape');
          const qs = query.length ? `?${query.join('&')}` : '';
          // Suffix only non-defaults so existing filenames/links don't churn.
          const suffix = `${variant}${bw ? '-bw' : ''}${landscape ? '-land' : ''}`;
          for (const r of regions) {
            const seg = r.slug ? `${r.level}/${r.slug}` : r.level;
            const namePrefix = r.slug ? `${r.level}-${r.slug}` : r.level;
            targets.push({
              route: `/${lang}/maps/print/${variant}/${seg}${qs}`,
              filename: `${namePrefix}-${suffix}-${lang}.pdf`,
              landscape,
            });
          }
        }
      }
    }
  }
  return targets;
}

function startServer() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost:${PORT}`);
      let filePath = join(DIST, url.pathname);
      try {
        const stat = await import('node:fs').then((fs) => fs.promises.stat(filePath));
        if (stat.isDirectory()) filePath = join(filePath, 'index.html');
      } catch {
        filePath = join(DIST, 'index.html');
      }
      try {
        const content = await readFile(filePath);
        const ext = filePath.split('.').pop();
        const mime =
          {
            html: 'text/html',
            js: 'application/javascript',
            css: 'text/css',
            json: 'application/json',
            svg: 'image/svg+xml',
            png: 'image/png',
            ico: 'image/x-icon',
            webmanifest: 'application/manifest+json',
            pdf: 'application/pdf',
          }[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime });
        res.end(content);
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
    });
    server.listen(PORT, () => resolve(server));
  });
}

async function renderRoute(browser, route) {
  const url = `http://localhost:${PORT}${route}`;
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForSelector('#root > *', { timeout: 10000 });

    let html = await page.content();
    html = html.replace('</head>', '<meta name="prerendered" content="true">\n</head>');

    if (route === '/') {
      await writeFile(join(DIST, 'index.html'), html, 'utf-8');
    } else {
      const outDir = join(DIST, route);
      await mkdir(outDir, { recursive: true });
      await writeFile(join(outDir, 'index.html'), html, 'utf-8');
    }
  } finally {
    await page.close();
  }
}

async function prerenderHtml(browser, routes) {
  console.log(`Pre-rendering ${routes.length} HTML routes (concurrency ${HTML_CONCURRENCY})...`);
  let done = 0;
  for (let i = 0; i < routes.length; i += HTML_CONCURRENCY) {
    const batch = routes.slice(i, i + HTML_CONCURRENCY);
    await Promise.all(
      batch.map(async (route) => {
        try {
          await renderRoute(browser, route);
        } catch (err) {
          // One retry — a transient ERR_ABORTED under concurrency shouldn't fail
          // the whole build. Same policy as the PDF phase.
          console.warn(`  retry ${route}: ${err.message?.split('\n')[0]}`);
          await renderRoute(browser, route);
        }
      }),
    );
    done += batch.length;
    if (done % 100 === 0 || done === routes.length) {
      console.log(`  HTML ${done}/${routes.length}`);
    }
  }
}

/**
 * Every URL we advertise in the sitemap must exist as a real file, or GitHub
 * Pages answers it with 404.html — which browsers survive via the SPA fallback
 * but crawlers read as a plain 404. This is the guard for the drift that let
 * 1584 of 1754 sitemap URLs go un-emitted; it fails the build rather than
 * shipping a sitemap that mostly 404s.
 */
async function verifySitemapCoverage() {
  const xml = await readFile(join(DIST, 'sitemap.xml'), 'utf-8');
  const locs = [...xml.matchAll(/<loc>https:\/\/quiz-korea\.ysw\.kr([^<]*)<\/loc>/g)].map((m) => m[1]);
  const missing = [];
  for (const loc of locs) {
    const rel = loc.replace(/\/$/, '');
    const file = rel === '' ? join(DIST, 'index.html') : join(DIST, rel, 'index.html');
    try {
      await readFile(file);
    } catch {
      missing.push(loc);
    }
  }
  if (missing.length > 0) {
    console.error(`\n${missing.length} of ${locs.length} sitemap URLs have no emitted file:`);
    for (const m of missing.slice(0, 10)) console.error(`  ${m}`);
    if (missing.length > 10) console.error(`  ...and ${missing.length - 10} more`);
    throw new Error('sitemap references URLs that were never pre-rendered');
  }
  console.log(`Sitemap coverage OK — all ${locs.length} URLs emitted.`);
}

async function renderTarget(browser, { route, filename, landscape }) {
  // A4 at 96dpi: portrait 794×1123, landscape 1123×794.
  const width = landscape ? 1123 : 794;
  const height = landscape ? 794 : 1123;
  const url = `http://localhost:${PORT}${route}`;
  // Fresh page per target — reusing one page across hundreds of D3 re-renders
  // leaks memory and eventually stalls the ready-wait.
  const page = await browser.newPage();
  try {
    await page.setViewport({ width, height, deviceScaleFactor: 2 });
    // domcontentloaded (not networkidle0): the data-print-ready selector below is
    // the real "map rendered" signal, and networkidle0 can deadlock under the
    // concurrency pool. Generous selector timeout for CPU-contended sigungu maps.
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('[data-print-ready="true"]', { timeout: 45000 });

    // Emulate print media for BOTH outputs. In screen media the print view
    // centers the A4 sheet on a gray "desk" with padding, which flex-shrinks the
    // sheet below the viewport width and clips the map's right edge in the
    // screenshot. Print media resets to a full-bleed sheet (no padding, no
    // floating print button), so the PNG matches the PDF exactly.
    await page.emulateMediaType('print');

    const pdf = await page.pdf({
      format: 'A4',
      landscape,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    await writeFile(join(DOWNLOADS, filename), pdf);

    // PNG preview — used by MapDownloadPage (cross-platform safe vs iframe PDF)
    const pngFilename = filename.replace(/\.pdf$/, '.png');
    const png = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width, height } });
    await writeFile(join(DOWNLOADS, pngFilename), png);
  } finally {
    await page.close();
  }
}

async function generatePdfs(browser, targets) {
  await mkdir(DOWNLOADS, { recursive: true });
  console.log(`Generating ${targets.length} PDFs + PNG previews...`);
  // Serial on purpose. Rendering concurrently sounds appealing (~650 targets),
  // but two heavy maps (national 시군, dense 시군구) capturing screenshots at the
  // same time starve each other via CDP/GPU contention — a fast ~4s render
  // balloons to 70–120s and trips protocolTimeout. Serial keeps every target at
  // its natural ~0.5–4s. Each target uses a fresh page (see renderTarget).
  let done = 0;
  for (const target of targets) {
    try {
      await renderTarget(browser, target);
    } catch (err) {
      // One retry — a transient stall shouldn't fail the whole build.
      console.warn(`  retry ${target.filename}: ${err.message?.split('\n')[0]}`);
      await renderTarget(browser, target);
    }
    done++;
    if (done % 25 === 0 || done === targets.length) {
      console.log(`  ${done}/${targets.length}`);
    }
  }
}

async function main() {
  const server = await startServer();
  const browser = await puppeteer.launch({
    headless: true,
    // --disable-dev-shm-usage: the default /dev/shm is too small for the large
    // deviceScaleFactor:2 A4 screenshots and Chrome crashes after ~30 of them.
    // --disable-gpu: headless stability. Both are standard CI-hardening flags.
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    protocolTimeout: 120000,
  });
  try {
    const dongCodes = await loadDongScopeCodes();
    await prerenderHtml(browser, buildHtmlRoutes(dongCodes));
    await generatePdfs(browser, buildPdfTargets());
    await verifySitemapCoverage();
    console.log('Pre-render + PDF generation complete.');
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error('Pre-render failed:', err);
  process.exit(1);
});
