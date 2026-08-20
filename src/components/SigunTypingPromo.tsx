import { useI18n } from '../i18n/useI18n';
import { SIDO_SLUG } from '../utils/regionUtils';
import type { AdminLevel } from '../types';

/**
 * Cross-promotion to sigun-typing.ysw.kr — a sibling site (same author) that is
 * a *game*: courses, live rankings, multiplayer rooms. This site is a practice
 * tool, so the two complement rather than compete; the pitch is always the part
 * we don't have (ranking / competing), never "another map quiz".
 *
 * Korean-only on purpose: sigun-typing has no English UI, so sending an English
 * visitor there is a dead end. Renders nothing when locale !== 'ko'.
 */

const BASE = 'https://sigun-typing.ysw.kr/';

/** utm tags so we can tell which surface (if any) actually converts. */
function href(medium: string, path = '') {
  return `${BASE}${path}?utm_source=quiz-korea&utm_medium=${medium}`;
}

/**
 * The region the player just drilled → the matching sigun-typing course.
 *
 * Their 시도 course ids are byte-identical to our SIDO_SLUG values (seoul,
 * gyeonggi, gangwon…), so the slug is the course id — no table to keep in sync.
 * Two whole-country courses cover the unfiltered cases: `sido` (17 시도) and
 * `nationwide` (전국 시군).
 *
 * 읍면동 is deliberately excluded: their dong courses are keyed per-시군구
 * ("seoul-jung", "seoul-yongsan"), which our 5-digit code can't produce without
 * a 251-entry mapping. Those fall back to the home page.
 *
 * 세종 ('29') has no course over there — it exists only inside `nationwide` —
 * and it has no SIDO_SLUG entry here either, so it lands in the same fallback.
 *
 * A wrong guess here is worse than no guess — a 404 on arrival kills the
 * handoff — so anything unrecognized falls back to home too.
 *
 * Mode is `map`, not `learn`: `learn` shows the name on screen (copy-typing,
 * no ranking), which is not what someone arriving from a finished quiz wants.
 */
function coursePath(adminLevel: AdminLevel, sidoCode?: string): string {
  if (adminLevel === 'dong') return '';
  if (sidoCode) {
    const slug = SIDO_SLUG[sidoCode];
    return slug ? `play/map/${slug}` : '';
  }
  return adminLevel === 'sido' ? 'play/map/sido' : 'play/map/nationwide';
}

function KeyboardMapIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z" />
      <path d="M9 3v15" />
      <path d="M15 6v15" />
    </svg>
  );
}

/**
 * Card shown at the bottom of a finished quiz's result screen.
 *
 * The pitch differs by the mode just played, because the two audiences are at
 * different points:
 *  - after `type`: they can already write the names — offer the scored,
 *    competitive version of the same thing.
 *  - after `pin`: they can find the regions but haven't been asked to spell
 *    them — offer that as the next wall, not as "a ranking".
 * Learn mode has no completion screen, so it has no surface here.
 */
const PITCH: Record<'type' | 'pin', string> = {
  type: '랭킹 걸고 겨루는 지명 타자 게임',
  pin: '이번엔 이름까지 쓸 수 있는지 — 지명 타자 게임',
};

interface ResultCardProps {
  mode: 'type' | 'pin';
  adminLevel: AdminLevel;
  /** Sido code the quiz was scoped to; undefined for 전국. */
  sidoCode?: string;
}

export function SigunTypingResultCard({ mode, adminLevel, sidoCode }: ResultCardProps) {
  const { locale } = useI18n();
  if (locale !== 'ko') return null;

  const path = coursePath(adminLevel, sidoCode);

  return (
    <a
      href={href(`result-${mode}`, path)}
      target="_blank"
      rel="noopener"
      className="mt-4 flex items-center gap-3 w-full text-left bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl px-3 py-2.5 transition-colors"
    >
      <span className="text-gray-400 shrink-0">
        <KeyboardMapIcon />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-gray-700">
          시군 타이핑
        </span>
        <span className="block text-xs text-gray-500 mt-0.5">
          {PITCH[mode]}
        </span>
      </span>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-gray-300 shrink-0"
        aria-hidden="true"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </a>
  );
}

/**
 * Quiet one-liner for the landing page — sits under the printable-maps banner,
 * above the footer, in the same muted tone so it reads as a sibling link and
 * not as an ad.
 */
export function SigunTypingLandingLink() {
  const { locale } = useI18n();
  if (locale !== 'ko') return null;

  return (
    <p className="mt-6 text-center text-xs text-gray-400">
      랭킹 걸고 겨루고 싶다면{' '}
      <a
        href={href('landing')}
        target="_blank"
        rel="noopener"
        className="font-medium text-gray-500 hover:text-blue-600 transition-colors"
      >
        시군 타이핑 →
      </a>
    </p>
  );
}
