import { useState, useCallback, useRef } from 'react';

export function useResponsiveSize() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const observerRef = useRef<ResizeObserver | null>(null);

  const containerRef = useCallback((el: HTMLDivElement | null) => {
    // Cleanup previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    if (!el) return;

    // Immediate measurement
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0) {
      setSize({ width: Math.floor(rect.width), height: Math.max(Math.floor(rect.height), 400) });
    }

    // Observe future resizes
    observerRef.current = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        setSize({ width: Math.floor(width), height: Math.max(Math.floor(height), 400) });
      }
    });
    observerRef.current.observe(el);
  }, []);

  return { containerRef, ...size };
}
