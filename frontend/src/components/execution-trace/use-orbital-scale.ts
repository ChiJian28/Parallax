'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Scale the orbital scene to fill the execution canvas.
 * Compensates for rotateX(60deg) foreshortening on the vertical axis.
 */
export function useOrbitalScale(maxRadius: number) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const update = () => {
      const { width, height } = root.getBoundingClientRect();
      const naturalDiameter = maxRadius * 2 + 96;
      const scaleW = (width * 0.92) / naturalDiameter;
      const scaleH = (height * 1.38) / naturalDiameter;
      setScale(Math.min(scaleW, scaleH, 2.1));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(root);
    window.addEventListener('resize', update);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [maxRadius]);

  return { rootRef, scale };
}
