import type { AdminLevel, QuizMode } from '../types';

// Local-only personal best records, kept in localStorage. One "best" per quiz
// config (mode + level + region + options + count). Better = more correct,
// tie-break by faster time.

export interface RecordMeta {
  mode: QuizMode;
  adminLevel: AdminLevel;
  /** sido code (non-dong) or 4/5-digit code (dong); undefined = 전국. */
  filter?: string;
  /** 0 = all regions; >0 = random subset of that size. */
  count: number;
  borderless?: boolean;
  noAccum?: boolean;
  outline?: boolean;
}

export interface RecordStats {
  correct: number;
  total: number;
  timeMs: number;
  dateISO: string;
}

export type RecordEntry = RecordMeta & RecordStats;

const PREFIX = 'qk:rec:';

export function recordKey(m: RecordMeta): string {
  const opt = `${m.borderless ? 'b' : ''}${m.noAccum ? 'n' : ''}${m.outline ? 'o' : ''}` || '-';
  return `${PREFIX}${m.mode}:${m.adminLevel}:${m.filter || 'all'}:${m.count || 0}:${opt}`;
}

function isBetter(a: RecordStats, b: RecordStats): boolean {
  if (a.correct !== b.correct) return a.correct > b.correct;
  return a.timeMs < b.timeMs;
}

/**
 * Record an attempt. Persists it only if it beats the stored best for this
 * config. Returns the resulting best, whether this attempt set a new best, and
 * the previous best (null if this was the first attempt).
 */
export function saveAttempt(
  meta: RecordMeta,
  stats: RecordStats,
): { best: RecordEntry; isNewBest: boolean; previous: RecordEntry | null } {
  const key = recordKey(meta);
  let previous: RecordEntry | null = null;
  try {
    const raw = localStorage.getItem(key);
    if (raw) previous = JSON.parse(raw) as RecordEntry;
  } catch { /* storage unavailable / corrupt */ }

  const attempt: RecordEntry = { ...meta, ...stats };
  const isNewBest = !previous || isBetter(attempt, previous);
  const best: RecordEntry = isNewBest ? attempt : previous!;
  if (isNewBest) {
    try { localStorage.setItem(key, JSON.stringify(attempt)); } catch { /* ignore */ }
  }
  return { best, isNewBest, previous };
}

export function getAllRecords(): RecordEntry[] {
  const out: RecordEntry[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(PREFIX)) continue;
      try {
        const e = JSON.parse(localStorage.getItem(k) as string) as RecordEntry;
        if (e && typeof e.correct === 'number') out.push(e);
      } catch { /* skip corrupt entry */ }
    }
  } catch { /* storage unavailable */ }
  return out;
}

export function clearAllRecords(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    for (const k of keys) localStorage.removeItem(k);
  } catch { /* ignore */ }
}

export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
