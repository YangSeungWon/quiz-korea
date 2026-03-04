import { useState, useEffect, useRef, useCallback } from 'react';

export function useResponsiveSize() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0) {
      setSize({ width: Math.floor(rect.width), height: Math.max(Math.floor(rect.height), 400) });
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Immediate measurement
    measure();

    const observer = new ResizeObserver(() => measure());
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  return { containerRef, ...size };
}
