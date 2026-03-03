import { useState, useEffect, useRef } from 'react';

export function useResponsiveSize() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 700, height: 600 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        setSize({ width: Math.floor(width), height: Math.max(Math.floor(height), 400) });
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { containerRef, ...size };
}
