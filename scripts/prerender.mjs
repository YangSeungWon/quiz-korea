/**
 * Post-build pre-rendering script.
 *
 * Spins up a static server for the built `dist/` directory, then uses Puppeteer
 * to visit each SPA route and save the fully-rendered HTML.  This gives search
 * engines a 200-status page with real content instead of the GitHub Pages 404
 * fallback.
 *
 * With path-based URLs each (mode, level, sido?) combination produces its own
 * static HTML so the canonical/title/description differ per filtered page —
 * essential for letting Google index 50+ filtered variants separately.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const PORT = 45678;

const QUIZ_MODES = ['pin', 'type'];
const LEVELS = ['sido', 'sigun', 'sigungu'];
// 광역시 (자치구). Sejong is excluded — single-tier 자치시 has no meaningful filter.
const METRO_SLUGS = ['seoul', 'busan', 'daegu', 'incheon', 'gwangju', 'daejeon', 'ulsan'];
const PROVINCE_SLUGS = ['gyeonggi', 'gangwon', 'chungbuk', 'chungnam', 'jeonbuk', 'jeonnam', 'gyeongbuk', 'gyeongnam', 'jeju'];

function buildRoutes() {
  const routes = ['/'];
  for (const mode of QUIZ_MODES) {
    for (const level of LEVELS) {
      routes.push(`/quiz/${mode}/${level}`);
    }
    // 광역시: filter at sigungu level (자치구)
    for (const slug of METRO_SLUGS) {
      routes.push(`/quiz/${mode}/sigungu/${slug}`);
    }
    // 도: filter at sigun level (시군)
    for (const slug of PROVINCE_SLUGS) {
      routes.push(`/quiz/${mode}/sigun/${slug}`);
    }
  }
  for (const level of LEVELS) {
    routes.push(`/learn/${level}`);
  }
  for (const slug of METRO_SLUGS) {
    routes.push(`/learn/sigungu/${slug}`);
  }
  for (const slug of PROVINCE_SLUGS) {
    routes.push(`/learn/sigun/${slug}`);
  }
  return routes;
}

/** Minimal static file server for the dist directory */
function startServer() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost:${PORT}`);
      let filePath = join(DIST, url.pathname);

      // SPA fallback: serve index.html for non-file paths
      try {
        const stat = await import('node:fs').then((fs) =>
          fs.promises.stat(filePath),
        );
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

async function prerender() {
  const routes = buildRoutes();
  console.log(`Starting pre-render of ${routes.length} routes...`);
  const server = await startServer();
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

  for (const route of routes) {
    const url = `http://localhost:${PORT}${route}`;
    console.log(`  Rendering ${route}`);

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

    await page.waitForSelector('#root > *', { timeout: 10000 });

    let html = await page.content();
    html = html.replace(
      '</head>',
      '<meta name="prerendered" content="true">\n</head>',
    );

    // Write to dist/[route]/index.html (root → dist/index.html, already exists)
    if (route !== '/') {
      const outDir = join(DIST, route);
      await mkdir(outDir, { recursive: true });
      await writeFile(join(outDir, 'index.html'), html, 'utf-8');
    } else {
      await writeFile(join(DIST, 'index.html'), html, 'utf-8');
    }

    await page.close();
  }

  await browser.close();
  server.close();
  console.log(`Pre-rendered ${routes.length} routes.`);
}

prerender().catch((err) => {
  console.error('Pre-render failed:', err);
  process.exit(1);
});
