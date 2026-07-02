'use client';

import { useCallback, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  EXECUTION_COMPLETE_LOG,
  EXECUTION_STEP_LOGS,
  STEP_DURATION_MS,
} from '@/lib/execution-logs';
import { ExecuteButton } from '@/components/execution-trace/execute-button';
import { OrbitalEngine } from '@/components/execution-trace/orbital-engine';
import { OrbitalHoverProbe } from '@/components/execution-trace/orbital-hover-probe';
import { OrbitalLegend } from '@/components/execution-trace/orbital-legend';
import { TerminalPanel } from '@/components/execution-trace/terminal-panel';

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function ExecutionTrace() {
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);
  const [selectedStep, setSelectedStep] = useState(1);
  const [logs, setLogs] = useState<string[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const runIdRef = useRef(0);

  const runPipeline = useCallback(async () => {
    const runId = ++runIdRef.current;
    setIsExecuting(true);
    setIsTerminalOpen(true);
    setLogs([]);
    setActiveStep(1);
    setSelectedStep(1);
    setLogs([EXECUTION_STEP_LOGS[1]]);

    for (let step = 2; step <= 5; step += 1) {
      await delay(STEP_DURATION_MS);
      if (runIdRef.current !== runId) return;

      setActiveStep(step);
      setSelectedStep(step);
      setLogs((prev) => [...prev, EXECUTION_STEP_LOGS[step]]);
    }

    await delay(STEP_DURATION_MS);
    if (runIdRef.current !== runId) return;

    setLogs((prev) => [...prev, EXECUTION_COMPLETE_LOG]);
    setActiveStep(0);
    setIsExecuting(false);
  }, []);

  const handleExecute = () => {
    if (isExecuting) return;
    void runPipeline();
  };

  return (
    <div className="execution-trace-canvas relative h-full w-full overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 70% 55% at 15% 35%, rgba(0, 255, 204, 0.07), transparent 60%),
            radial-gradient(ellipse 55% 45% at 85% 65%, rgba(2, 226, 177, 0.05), transparent 55%),
            radial-gradient(circle at 50% 120%, rgba(255, 255, 255, 0.03), transparent 45%),
            #0B0C10
          `,
        }}
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 75%)',
        }}
      />

      <OrbitalEngine
        activeStep={activeStep}
        hoveredStep={hoveredStep}
        selectedStep={selectedStep}
        onHoverStep={setHoveredStep}
        onSelectStep={setSelectedStep}
      />

      <OrbitalHoverProbe hoveredStep={hoveredStep} />

      <OrbitalLegend
        activeStep={activeStep}
        hoveredStep={hoveredStep}
        selectedStep={selectedStep}
        onHoverStep={setHoveredStep}
        onSelectStep={setSelectedStep}
      />

      <button
        type="button"
        onClick={() => setIsTerminalOpen((open) => !open)}
        aria-label={isTerminalOpen ? 'Close execution trace' : 'Open execution trace'}
        aria-expanded={isTerminalOpen}
        className={cn(
          'absolute top-1/2 z-30 -translate-y-1/2',
          'flex h-12 w-10 items-center justify-center',
          'border border-white/10 bg-black/50 text-parallax-fg backdrop-blur-xl',
          'transition-colors hover:border-parallax-accent/40 hover:text-parallax-accent',
          isTerminalOpen ? 'right-96 rounded-l-lg border-r-0' : 'right-0 rounded-l-xl',
        )}
      >
        {isTerminalOpen ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <Terminal className="h-4 w-4" />
        )}
      </button>

      <AnimatePresence>
        {isTerminalOpen && (
          <motion.aside
            key="terminal-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="absolute right-0 top-0 z-20 h-full w-96 border-l border-white/10 bg-black/40 backdrop-blur-xl"
          >
            <TerminalPanel logs={logs} isExecuting={isExecuting} />
          </motion.aside>
        )}
      </AnimatePresence>

      <ExecuteButton onExecute={handleExecute} isExecuting={isExecuting} />
    </div>
  );
}
