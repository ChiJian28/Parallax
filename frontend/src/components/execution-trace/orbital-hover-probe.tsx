'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { getOrbitalPhase } from '@/lib/orbital-phases';
import { cn } from '@/lib/utils';

interface OrbitalHoverProbeProps {
  hoveredStep: number | null;
}

export function OrbitalHoverProbe({ hoveredStep }: OrbitalHoverProbeProps) {
  const phase = hoveredStep != null ? getOrbitalPhase(hoveredStep) : undefined;

  return (
    <AnimatePresence>
      {phase && (
        <motion.div
          key={phase.id}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 15 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-none absolute bottom-6 left-4 z-30 w-80 rounded-2xl border border-parallax-accent/40 bg-slate-950/75 p-4 shadow-2xl backdrop-blur-md sm:left-6"
          style={{
            boxShadow: '0 20px 50px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          <div className="flex items-start justify-between">
            <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-parallax-accent">
              Glassmorphism Micro-Probe
            </span>
            <span className="rounded border border-slate-800 bg-slate-900/90 px-1.5 py-0.5 font-mono text-[9px] text-slate-400">
              {phase.latency}
            </span>
          </div>

          <h4 className="mt-2 flex items-center gap-1.5 text-sm font-black text-slate-100">
            <span
              className={cn('h-2.5 w-2.5 shrink-0 rounded-full bg-gradient-to-r', phase.bgGradient)}
              aria-hidden
            />
            {phase.name}
          </h4>

          <p className="mt-1 text-[11px] leading-normal text-slate-400">{phase.description}</p>

          <div className="mt-4 space-y-1.5 border-t border-slate-900 pt-2.5 font-mono text-[10px]">
            <div className="flex justify-between text-slate-500">
              <span>Real Solar Hue:</span>
              <span className="font-bold text-slate-300">{phase.colorName}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Status:</span>
              <span className="font-bold text-emerald-400">Success</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
