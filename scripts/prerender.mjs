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

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const DOWNLOADS = join(DIST, 'downloads');
const PORT = 45678;

const QUIZ_MODES = ['pin', 'type'];
const LEVELS = ['sido', 'sigun', 'sigungu'];
const METRO_SLUGS = ['seoul', 'busan', 'daegu', 'incheon', 'gwangju', 'daejeon', 'ulsan'];
const PROVINCE_SLUGS = ['gyeonggi', 'gangwon', 'chungbuk', 'chungnam', 'jeonbuk', 'jeonnam', 'gyeongbuk', 'gyeongnam', 'jeju'];
const LOCALES = ['ko', 'en'];

function buildLanglessPaths() {
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
  return paths;
}

function buildHtmlRoutes() {
  const langless = buildLanglessPaths();
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
  const variants = ['blank', 'label'];
  for (const lang of LOCALES) {
    for (const variant of variants) {
      for (const level of ['sido', 'sigun']) {
        targets.push({
          route: `/${lang}/maps/print/${variant}/${level}`,
          filename: `${level}-${variant}-${lang}.pdf`,
        });
      }
      for (const slug of METRO_SLUGS) {
        targets.push({
          route: `/${lang}/maps/print/${variant}/sigungu/${slug}`,
          filename: `sigungu-${slug}-${variant}-${lang}.pdf`,
        });
      }
      for (const slug of PROVINCE_SLUGS) {
        targets.push({
          route: `/${lang}/maps/print/${variant}/sigun/${slug}`,
          filename: `sigun-${slug}-${variant}-${lang}.pdf`,
        });
      }
      for (const slug of PROVINCE_SLUGS) {
        targets.push({
          route: `/${lang}/maps/print/${variant}/sigungu/${slug}`,
          filename: `sigungu-${slug}-${variant}-${lang}.pdf`,
        });
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

async function prerenderHtml(browser, routes) {
  console.log(`Pre-rendering ${routes.length} HTML routes...`);
  for (const route of routes) {
    const url = `http://localhost:${PORT}${route}`;
    console.log(`  HTML ${route}`);
    const page = await browser.newPage();
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
    await page.close();
  }
}

async function generatePdfs(browser, targets) {
  await mkdir(DOWNLOADS, { recursive: true });
  console.log(`Generating ${targets.length} PDFs + PNG previews...`);
  for (const { route, filename } of targets) {
    const url = `http://localhost:${PORT}${route}`;
    console.log(`  ${filename}`);
    const page = await browser.newPage();
    // A4 portrait at 96dpi: 794 × 1123 px
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForSelector('[data-print-ready="true"]', { timeout: 15000 });

    // Emulate print media for BOTH outputs. In screen media the print view
    // centers the A4 sheet on a gray "desk" with padding, which flex-shrinks the
    // 794px sheet below the viewport width and clips the map's right edge in the
    // screenshot. Print media resets to a full-bleed 794×1123 sheet (no padding,
    // no floating print button), so the PNG matches the PDF exactly.
    await page.emulateMediaType('print');

    const pdf = await page.pdf({
      format: 'A4',
      landscape: false,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    await writeFile(join(DOWNLOADS, filename), pdf);

    // PNG preview — used by MapDownloadPage (cross-platform safe vs iframe PDF)
    const pngFilename = filename.replace(/\.pdf$/, '.png');
    const png = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width: 794, height: 1123 },
    });
    await writeFile(join(DOWNLOADS, pngFilename), png);

    await page.close();
  }
}

async function main() {
  const server = await startServer();
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    await prerenderHtml(browser, buildHtmlRoutes());
    await generatePdfs(browser, buildPdfTargets());
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
