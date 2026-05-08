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

function buildHtmlRoutes() {
  const routes = ['/'];
  for (const mode of QUIZ_MODES) {
    for (const level of LEVELS) routes.push(`/quiz/${mode}/${level}`);
    for (const slug of METRO_SLUGS) routes.push(`/quiz/${mode}/sigungu/${slug}`);
    for (const slug of PROVINCE_SLUGS) routes.push(`/quiz/${mode}/sigun/${slug}`);
  }
  for (const level of LEVELS) routes.push(`/learn/${level}`);
  for (const slug of METRO_SLUGS) routes.push(`/learn/sigungu/${slug}`);
  for (const slug of PROVINCE_SLUGS) routes.push(`/learn/sigun/${slug}`);
  // Maps download pages (HTML)
  for (const level of LEVELS) routes.push(`/maps/${level}`);
  for (const slug of METRO_SLUGS) routes.push(`/maps/sigungu/${slug}`);
  for (const slug of PROVINCE_SLUGS) routes.push(`/maps/sigun/${slug}`);
  return routes;
}

function buildPdfTargets() {
  // Each entry: { route, filename }
  const targets = [];
  const variants = ['blank', 'label'];
  for (const variant of variants) {
    for (const level of LEVELS) {
      targets.push({
        route: `/maps/print/${variant}/${level}`,
        filename: `${level}-${variant}.pdf`,
      });
    }
    for (const slug of METRO_SLUGS) {
      targets.push({
        route: `/maps/print/${variant}/sigungu/${slug}`,
        filename: `sigungu-${slug}-${variant}.pdf`,
      });
    }
    for (const slug of PROVINCE_SLUGS) {
      targets.push({
        route: `/maps/print/${variant}/sigun/${slug}`,
        filename: `sigun-${slug}-${variant}.pdf`,
      });
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
  console.log(`Generating ${targets.length} PDFs...`);
  for (const { route, filename } of targets) {
    const url = `http://localhost:${PORT}${route}`;
    console.log(`  PDF  ${filename}`);
    const page = await browser.newPage();
    // A4 portrait at 96dpi: 794 × 1123 px
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForSelector('[data-print-ready="true"]', { timeout: 15000 });

    const pdf = await page.pdf({
      format: 'A4',
      landscape: false,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    await writeFile(join(DOWNLOADS, filename), pdf);
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
