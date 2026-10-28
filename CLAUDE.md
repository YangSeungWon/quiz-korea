# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Start dev server (port 10000, allows `*.ysw.kr` hosts)
- `npm run build` — `tsc -b` → `scripts/buildSitemap.mjs` → `vite build` → `scripts/prerender.mjs` (Puppeteer: prerendered HTML per route + printable PDFs in `dist/downloads/`)
- `npm run lint` — ESLint (flat config, ESLint 9)
- `npm run preview` — Preview production build
- `node scripts/genSidoRegions.mjs` — Regenerate `src/data/sidoRegions.ts` after any `public/data` change

No test framework is configured. Deploy is `.github/workflows/deploy.yml` on push to `main` (installs Noto CJK fonts for PDF rendering).

## Architecture

Korean geography quiz SPA (Seterra-style). React 19 + TypeScript + d3 modules (`d3-geo`, `d3-selection`, `d3-zoom`) + TailwindCSS 4. Deployed to GitHub Pages at `quiz-korea.ysw.kr`. Bilingual (ko/en).

### Routing

react-router-dom v7 (`BrowserRouter` in `App.tsx`). All real routes live under `/:lang` (`ko` | `en`):
- `/:lang/` → `LandingPage`
- `/:lang/quiz/:mode/:level[/:sidoSlug]` → `QuizSession`
- `/:lang/learn/:level[/:sidoSlug]` → `LearnMode`
- `/:lang/maps/:level[/:sidoSlug]` → `MapDownloadPage`
- `/:lang/maps/print/:variant/:level[/:sidoSlug]` → `MapPrintView` (used by prerender to make PDFs; `?bw=1`, `?orient=landscape`)
- `/:lang/records` → `RecordsPage`

`/` redirects by browser language (or `?lang=`). Legacy URLs (`/quiz/:mode?level=&filter=`, unprefixed path routes) are redirected in `App.tsx` — keep them working.

Quiz query params: `?borderless=1&noaccum=1&outline=1&count=N` (`count` = random subset size, 0 = all).

`sidoSlug` ↔ sido code mapping: `SIDO_SLUG` / `getSidoMeta()` in `regionUtils.ts`. Script-side slugs: `scripts/regionSlugs.mjs`.

GitHub Pages SPA routing: `public/404.html` encodes the path into a query string, and a script in `index.html` restores it on load. Prerendered routes are served as real HTML.

### Quiz Modes

| Mode | Prompt | Map Display |
|------|--------|-------------|
| `pin` | "Click on X" | Full map with borders |
| `pin` + `?borderless=1` | "Click on X" | Country outline only (borderless) |
| `pin` + `?noaccum=1` | "Click on X" | Correct answers fade after 1s, re-clickable |
| `type` | Type input | Full map, target highlighted blue |
| `type` + `?outline=1` | Type input | Single region outline only |
| Learn | Hover to see names | Full map with labels |

### Core Mechanics

- Queue = all regions in scope (or `count` random subset)
- Wrong answers stay on current question until correct (no recycling)
- 3+ wrong on same question → answer blinks red 3 times (300ms intervals)
- Scoring: `100 * totalRegions / (totalRegions + wrongAttempts)`
- Elapsed timer (not countdown)
- Type mode accepts short forms: "서울" → "서울특별시", etc.
- Personal bests stored in `localStorage` (`utils/records.ts`), one per config
- Results: shareable image card (`utils/resultCard.ts`), Kakao share (`utils/kakao.ts`)

### Admin Levels (`AdminLevel`)

- **sido** (시도) — 17 provinces/metropolitan cities
- **sigun** (시군) — derived at runtime from sigungu data (`utils/sigunMerge.ts`): metro cities collapse into one region, 구 of 일반시 merge into their 시
- **sigungu** (시군구) — ~250 districts, filterable by sido
- **dong** (읍면동) — requires a sigungu filter; loaded per 시도

### Data

Source: SGIS 2025 census boundaries, **SGIS native codes** (서울=11, 부산=21, … 세종=29 — not 행안부 codes).

- `public/data/korea-sido.json` — props `CTPRVN_CD`, `CTP_KOR_NM`, `CTP_ENG_NM`
- `public/data/korea-sigungu.json` — props `SIG_CD` (5-digit), `SIG_KOR_NM`
- `public/data/dong/korea-dong-{sido}.json` — props `code` (8-digit), `name`

All TopoJSON. `utils/dataLoader.ts` (`loadKoreaMapData`) fetches, converts to GeoJSON and caches; `useMapData(level, filter)` returns `{ geoData, topoData, borderMesh, loading, error }`.

`regionUtils.ts` resolves keys via fallback chains:
- **Code**: `getRegionCode()` — `CTPRVN_CD` → `SIG_CD` → `code`
- **Name**: `getRegionName()` — `CTP_KOR_NM` → `SIG_KOR_NM` → `name`
- Locale-aware display names: `getDisplayName` / `getShortDisplayName` / `getCompactDisplayName`; English names in `src/i18n/regions/`

`src/data/sidoRegions.ts` is generated (see Commands) — baked-in name lists so prerendered `/maps/{level}/{sido}/` pages have unique content.

### i18n

`src/i18n/` — `I18nContext` + `useI18n()`; strings in `ko.ts` / `en.ts`; Korean particle helper in `postposition.ts`; region English names in `regions/`. Use `useLocalePath` for building links; `usePageMeta` for per-page title/description/canonical.

### D3 + React Integration Pattern

`src/maps/QuizMap.tsx` uses `useRef` for SVG and `useEffect` for imperative D3 rendering. Display modes (`MapDisplayMode`): `normal`, `borderless` (outer boundary via `topojson.mesh`), `outline-only` (single region fitted to viewport). Label placement in `utils/labelPlacement.ts`.

### State Management

No global state library. Quiz state via `useQuizEngine` (`useReducer`: START, ANSWER_CORRECT, ANSWER_WRONG, CLEAR_FLASH, SET_FLASH, RESET). Timer via `useTimer`. Responsive sizing via `useResponsiveSize` (ResizeObserver).

### SEO / Build Scripts

- `buildSitemap.mjs` — generates `public/sitemap.xml`; every URL must correspond to a prerendered route (past bug: most entries 404'd)
- `prerender.mjs` — Puppeteer over `dist/`: writes HTML per route/locale, then PDFs for `/maps/print/*`
- `buildOgImage.mjs` — OG images (`public/og-image{,-en}.png`); not part of build, run manually

### Key Directories

- `src/maps/` — `QuizMap.tsx`
- `src/components/quiz/` — QuizSession, QuizProgress, QuizPrompt, TypeInput, QuizResults
- `src/components/landing/` — LandingPage, QuizCard, RegionPicker
- `src/components/learn/` — LearnMode
- `src/components/maps/` — MapDownloadPage, MapPrintView, MapPrintLinks, PrintInset, MapsBanner
- `src/components/records/` — RecordsPage
- `src/hooks/` — useMapData, useQuizEngine, useTimer, useResponsiveSize, useLocalePath, usePageMeta
- `src/utils/` — regionUtils, sigunMerge, dataLoader, quizEngine, records, labelPlacement, resultCard, kakao
- `src/types/index.ts` — Core TypeScript types
- `scripts/` — build-time Node scripts
- `public/data/` — TopoJSON boundary files
