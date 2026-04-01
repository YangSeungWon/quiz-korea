/**
 * Post-build pre-rendering script.
 *
 * Spins up a static server for the built `dist/` directory, then uses Puppeteer
 * to visit each SPA route and save the fully-rendered HTML.  This gives search
 * engines a 200-status page with real content instead of the GitHub Pages 404
 * fallback.
 *
 * Only base paths need pre-rendering — query-param variants (e.g. ?level=sido)
 * are served from the same file by GitHub Pages.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const PORT = 45678;

// Routes to pre-render (base paths only — query params don't affect file lookup)
const ROUTES = ['/quiz/pin', '/quiz/type', '/learn'];

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
  console.log('Starting pre-render...');
  const server = await startServer();
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

  for (const route of ROUTES) {
    const url = `http://localhost:${PORT}${route}`;
    console.log(`  Rendering ${route}`);

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

    // Wait a bit for React to fully render
    await page.waitForSelector('#root > *', { timeout: 10000 });

    let html = await page.content();

    // Inject a marker so the client-side app knows this is pre-rendered
    // and can hydrate properly
    html = html.replace(
      '</head>',
      '<meta name="prerendered" content="true">\n</head>',
    );

    // Write to dist/[route]/index.html
    const outDir = join(DIST, route);
    await mkdir(outDir, { recursive: true });
    await writeFile(join(outDir, 'index.html'), html, 'utf-8');

    await page.close();
  }

  await browser.close();
  server.close();
  console.log(`Pre-rendered ${ROUTES.length} routes.`);
}

prerender().catch((err) => {
  console.error('Pre-render failed:', err);
  process.exit(1);
});
