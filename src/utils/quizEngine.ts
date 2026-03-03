import type { QuizRegion } from '../types';

// Fisher-Yates shuffle
export function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Move wrong region to a random position in the back half of the queue
export function recycleWrong(queue: QuizRegion[], currentIndex: number): QuizRegion[] {
  const result = [...queue];
  const wrongRegion = result[currentIndex];
  // Remove from current position
  result.splice(currentIndex, 1);
  // Insert at random position in back half
  const remaining = result.length - currentIndex;
  const backHalfStart = currentIndex + Math.max(1, Math.floor(remaining / 2));
  const insertAt = backHalfStart + Math.floor(Math.random() * (result.length - backHalfStart + 1));
  result.splice(insertAt, 0, wrongRegion);
  return result;
}

// Seterra-style scoring: 100 * totalRegions / (totalRegions + wrongAttempts)
export function calculateScore(totalRegions: number, wrongAttempts: number): number {
  if (totalRegions === 0) return 0;
  return Math.round((100 * totalRegions) / (totalRegions + wrongAttempts));
}
