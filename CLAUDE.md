# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Start dev server (port 10000)
- `npm run build` — Type-check with `tsc -b` then build with Vite
- `npm run lint` — ESLint (flat config, ESLint 9)
- `npm run preview` — Preview production build

No test framework is configured.

## Architecture

Korean geography quiz SPA (Seterra-style). React 19 + TypeScript + D3.js + TailwindCSS 4. Deployed to GitHub Pages at `quiz-korea.ysw.kr`.

### Routing

Routes via react-router-dom v7 (`BrowserRouter` in `App.tsx`):
- `/` → `LandingPage` (mode selector)
- `/quiz/:mode` → `QuizSession` (pin, type)
- `/learn` → `LearnMode` (free exploration)

Query params: `?level=sido|sigungu&filter=<sidoCode>&borderless=1&noaccum=1&outline=1`

GitHub Pages SPA routing: `public/404.html` encodes the path into a query string, and a script in `index.html` restores it on load.

### Quiz Modes

| Mode | Prompt | Map Display |
|------|--------|-------------|
| `pin` | "Click on X" | Full map with borders |
| `pin` + `?borderless=1` | "Click on X" | Country outline only (borderless) |
| `pin` + `?noaccum=1` | "Click on X" | Correct answers fade after 1s, re-clickable |
| `type` | Type input | Full map, target highlighted blue |
| `type` + `?outline=1` | Type input | Single region outline only |
| Learn | Hover to see names | Full map with labels |

Options are toggles on the landing page, passed as query params.

### Core Mechanics

- All regions in the queue (17 sido or ~250 sigungu)
- Wrong answers stay on current question until correct (no recycling)
- 3+ wrong on same question → answer blinks red 3 times (300ms intervals)
- Scoring: `100 * totalRegions / (totalRegions + wrongAttempts)`
- Elapsed timer (not countdown)
- Type mode accepts short forms: "서울" → "서울특별시", etc.

### Data Flow

1. **Geographic data**: `useMapData(adminLevel)` returns `{ geoData, topoData }` — fetches TopoJSON from `public/data/korea-{sido|sigungu}.json`, converts to GeoJSON
2. **Region extraction**: `regionUtils.extractRegions(geoData, sidoFilter)` → `QuizRegion[]`
3. **Quiz state**: `useQuizEngine` hook — `useReducer` with actions START, ANSWER_CORRECT, ANSWER_WRONG, CLEAR_FLASH, SET_FLASH, RESET

### D3 + React Integration Pattern

`QuizMap` component uses `useRef` for SVG and `useEffect` for imperative D3 rendering. Supports three display modes: normal (full borders), borderless (outer boundary only via `topojson.mesh`), outline-only (single region fitted to viewport).

### GeoJSON Property Keys

Region identification uses fallback chains in `regionUtils.ts`:
- **Code**: `getRegionCode()` — `CTPRVN_CD` → `SIG_CD` → `code`
- **Name**: `getRegionName()` — `CTP_KOR_NM` → `SIG_KOR_NM` → `name`

### State Management

No global state library. Landing page uses local `useState`. Quiz state managed by `useQuizEngine` (useReducer). Timer via `useTimer`. Responsive sizing via `useResponsiveSize` (ResizeObserver).

### Admin Levels

- **sido** (시도) — 17 provinces/metropolitan cities
- **sigungu** (시군구) — ~250 districts, filterable by sido

### Key Directories

- `src/maps/` — `QuizMap.tsx` (D3 map with display modes)
- `src/components/quiz/` — QuizSession, QuizProgress, QuizPrompt, TypeInput, QuizResults
- `src/components/landing/` — LandingPage, QuizCard, AdminLevelPicker, SidoFilterPicker
- `src/components/learn/` — LearnMode
- `src/hooks/` — useMapData, useQuizEngine, useTimer, useResponsiveSize
- `src/utils/` — regionUtils (name matching), quizEngine (scoring/shuffle), dataLoader
- `src/types/index.ts` — All TypeScript type definitions
- `public/data/` — TopoJSON geographic boundary files
