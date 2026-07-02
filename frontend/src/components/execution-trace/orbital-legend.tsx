'use client';

import { ORBITAL_PHASES } from '@/lib/orbital-phases';
import { cn } from '@/lib/utils';

interface OrbitalLegendProps {
  activeStep: number;
  hoveredStep: number | null;
  selectedStep: number;
  onHoverStep: (step: number | null) => void;
  onSelectStep: (step: number) => void;
}

export function OrbitalLegend({
  activeStep,
  hoveredStep,
  selectedStep,
  onHoverStep,
  onSelectStep,
}: OrbitalLegendProps) {
  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-24 z-20 flex justify-center px-4 sm:px-6">
      <ul className="flex flex-wrap items-center justify-center gap-3">
        {ORBITAL_PHASES.map((phase) => {
          const isActive = activeStep === phase.id;
          const isHovered = hoveredStep === phase.id;
          const isSelected = selectedStep === phase.id;

          return (
            <li key={phase.id}>
              <button
                type="button"
                onMouseEnter={() => onHoverStep(phase.id)}
                onMouseLeave={() => onHoverStep(null)}
                onClick={() => onSelectStep(phase.id)}
                className={cn(
                  'flex items-center gap-1 font-mono text-[10px] transition-colors',
                  isActive || isSelected
                    ? 'text-parallax-accent'
                    : isHovered
                      ? 'text-slate-200'
                      : 'text-slate-500',
                )}
              >
                <span className={cn('h-2 w-2 rounded-full', phase.legendDotClass)} aria-hidden />
                {phase.name}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
