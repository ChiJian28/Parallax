'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface TypewriterTeaserProps {
  text?: string;
  className?: string;
  speedMs?: number;
}

export function TypewriterTeaser({ text, className, speedMs = 22 }: TypewriterTeaserProps) {
  const safeText = text ?? '';
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed('');
    setDone(false);

    if (!safeText) {
      setDone(true);
      return;
    }

    let index = 0;

    const timer = window.setInterval(() => {
      index += 1;
      setDisplayed(safeText.slice(0, index));
      if (index >= safeText.length) {
        window.clearInterval(timer);
        setDone(true);
      }
    }, speedMs);

    return () => window.clearInterval(timer);
  }, [safeText, speedMs]);

  if (!safeText) return null;

  return (
    <motion.div
      key={safeText}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      <p className="font-geist-mono text-sm leading-relaxed text-parallax-fg sm:text-[15px]">
        {displayed}
        {!done && (
          <motion.span
            aria-hidden
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.55, repeat: Infinity, repeatType: 'reverse' }}
            className="ml-0.5 inline-block text-parallax-accent"
          >
            |
          </motion.span>
        )}
      </p>
    </motion.div>
  );
}
