import { useState, useEffect, useRef } from 'react';

export function useResponsiveSize() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 600, height: 500 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width } = entry.contentRect;
        // Maintain roughly 5:4 aspect ratio, capped
        const w = Math.min(width, 800);
        const h = Math.min(Math.round(w * 0.85), 650);
        setSize({ width: w, height: h });
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { containerRef, ...size };
}
