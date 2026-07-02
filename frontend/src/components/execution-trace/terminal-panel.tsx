'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TerminalPanelProps {
  logs: string[];
  isExecuting: boolean;
}

export function TerminalPanel({ logs, isExecuting }: TerminalPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-white/10 px-4 py-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-parallax-accent">
          Execution Trace
        </p>
        <p className="mt-1 font-mono text-xs text-parallax-fg-muted">
          MCP · correlation pipeline · on-chain writes
        </p>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 font-mono text-xs">
        <ul className="space-y-2" aria-label="Execution log" aria-live="polite">
          <AnimatePresence initial={false}>
            {logs.map((line, index) => (
              <motion.li
                key={`${line}-${index}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25 }}
                className="text-parallax-fg-muted"
              >
                <span className="text-parallax-accent/70">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="mx-2 text-parallax-fg-muted/40">│</span>
                {line}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        {!isExecuting && logs.length === 0 && (
          <p className="mt-6 text-parallax-fg-muted/60">
            <span className="text-parallax-accent">&gt;</span> awaiting execution…
          </p>
        )}

        {isExecuting && (
          <motion.p
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className="mt-4 text-parallax-accent/80"
          >
            <span className="text-parallax-accent">&gt;</span> pipeline running…
          </motion.p>
        )}
      </div>
    </div>
  );
}
