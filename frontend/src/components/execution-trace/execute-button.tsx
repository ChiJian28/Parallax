'use client';

import { motion } from 'framer-motion';
import { Loader2, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExecuteButtonProps {
  onExecute: () => void;
  isExecuting: boolean;
}

export function ExecuteButton({ onExecute, isExecuting }: ExecuteButtonProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-8 z-30 flex justify-center">
      <motion.button
        type="button"
        onClick={onExecute}
        disabled={isExecuting}
        whileHover={isExecuting ? undefined : { scale: 1.03 }}
        whileTap={isExecuting ? undefined : { scale: 0.97 }}
        className={cn(
          'pointer-events-auto group relative overflow-hidden rounded-xl px-10 py-4',
          isExecuting && 'cursor-wait opacity-90',
        )}
      >
        <span
          aria-hidden
          className="absolute inset-0 rounded-xl bg-parallax-accent opacity-90 transition-opacity group-hover:opacity-100"
        />
        <span
          aria-hidden
          className={cn(
            'absolute -inset-1 rounded-xl bg-parallax-accent/40 blur-xl transition-opacity',
            !isExecuting && 'group-hover:opacity-80',
          )}
        />
        {!isExecuting && (
          <span
            aria-hidden
            className="absolute inset-0 rounded-xl opacity-0 transition-opacity group-hover:opacity-100"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 2.5s linear infinite',
            }}
          />
        )}

        <span className="relative flex items-center gap-2.5 font-mono text-sm font-semibold tracking-[0.15em] text-parallax-bg">
          {isExecuting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              EXECUTING…
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" />
              EXECUTE PARALLAX
            </>
          )}
        </span>
      </motion.button>
    </div>
  );
}
