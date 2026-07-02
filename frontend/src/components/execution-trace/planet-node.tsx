'use client';

import { motion } from 'framer-motion';
import type { OrbitalPhase } from '@/lib/orbital-phases';
import { PLANET_BILLBOARD_TRANSFORM } from '@/lib/orbital-phases';
import { cn } from '@/lib/utils';

interface PlanetNodeProps {
  phase: OrbitalPhase;
  isActive: boolean;
  isHovered: boolean;
  isSelected: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onSelect: () => void;
}

export function PlanetNode({
  phase,
  isActive,
  isHovered,
  isSelected,
  onHoverStart,
  onHoverEnd,
  onSelect,
}: PlanetNodeProps) {
  const Icon = phase.icon;

  const glowShadow = isActive
    ? `0 0 15px ${phase.glowColor}, 0 0 40px ${phase.glowColor}, 0 0 15px ${phase.glowColor}`
    : isSelected
      ? `0 0 25px ${phase.glowColor}`
      : isHovered
        ? `0 0 20px ${phase.glowColor}`
        : `0 0 6px ${phase.glowColor}`;

  return (
    <div
      className="pointer-events-auto absolute left-1/2 top-0 cursor-pointer"
      style={{
        transformStyle: 'preserve-3d',
        transform: `translate(-50%, -50%) ${PLANET_BILLBOARD_TRANSFORM}`,
      }}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect();
      }}
      role="button"
      tabIndex={0}
      aria-label={`${phase.name}: ${phase.description}`}
    >
      <motion.div
        animate={
          isActive
            ? {
                y: [0, -12, 0],
                scale: [1, 1.25, 1],
                boxShadow: [
                  `0 0 15px ${phase.glowColor}`,
                  `0 0 40px ${phase.glowColor}`,
                  `0 0 15px ${phase.glowColor}`,
                ],
              }
            : {}
        }
        transition={
          isActive
            ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0.25 }
        }
      >
        <motion.div
          whileHover={!isActive ? { scale: 1.35 } : undefined}
          className={cn(
            'relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 bg-gradient-to-br shadow-lg',
            phase.bgGradient,
            isSelected
              ? 'border-white ring-4 ring-parallax-accent/50'
              : 'border-slate-950',
          )}
          style={{ boxShadow: glowShadow }}
        >
          <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full">
            <Icon className="relative z-10 h-5 w-5 text-slate-950" strokeWidth={2.25} />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-black/50 via-transparent to-white/20" />
            {phase.id === 5 && (
              <div className="pointer-events-none absolute h-2.5 w-14 scale-125 rotate-12 skew-y-12 rounded-full border-2 border-purple-300/40 bg-purple-500/10" />
            )}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
