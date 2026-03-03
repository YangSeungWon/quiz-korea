import { useState, useEffect, useRef } from 'react';
import type { QuizPhase } from '../types';

export function useTimer(phase: QuizPhase) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    if (phase === 'playing') {
      startTimeRef.current = Date.now();

      const tick = () => {
        if (startTimeRef.current !== null) {
          setElapsedMs(Date.now() - startTimeRef.current);
          animFrameRef.current = requestAnimationFrame(tick);
        }
      };

      animFrameRef.current = requestAnimationFrame(tick);
    } else {
      startTimeRef.current = null;
      cancelAnimationFrame(animFrameRef.current);
    }

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [phase]);

  const formatted = formatTime(elapsedMs);

  return { elapsedMs, formatted };
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
