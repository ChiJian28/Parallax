'use client';

import { motion } from 'framer-motion';
import {
  ORBITAL_MAX_RADIUS,
  ORBITAL_PHASES,
  ORBITAL_PERSPECTIVE_PX,
  ORBITAL_TILT_DEG,
  ORBITAL_TILT_Y_DEG,
} from '@/lib/orbital-phases';
import { PlanetNode } from '@/components/execution-trace/planet-node';
import { useOrbitalScale } from '@/components/execution-trace/use-orbital-scale';
import { cn } from '@/lib/utils';

export interface OrbitalEngineProps {
  activeStep: number;
  hoveredStep: number | null;
  selectedStep: number;
  onHoverStep: (step: number | null) => void;
  onSelectStep: (step: number) => void;
}

export function OrbitalEngine({
  activeStep,
  hoveredStep,
  selectedStep,
  onHoverStep,
  onSelectStep,
}: OrbitalEngineProps) {
  const { rootRef, scale } = useOrbitalScale(ORBITAL_MAX_RADIUS);

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 z-[5] flex items-center justify-center overflow-hidden"
      style={{ perspective: `${ORBITAL_PERSPECTIVE_PX}px` }}
    >
      <div
        className="relative flex h-full w-full items-center justify-center"
        style={{ transform: `scale(${scale})` }}
      >
        {/* Sun — OUTSIDE tilt plane, always faces viewer (SchemeSeven pattern) */}
        <div className="absolute z-30 flex flex-col items-center">
          <motion.div
            animate={{
              scale: [0.95, 1.08, 0.95],
              boxShadow: [
                '0 0 35px rgba(234,179,8,0.4)',
                '0 0 65px rgba(249,115,22,0.7)',
                '0 0 35px rgba(234,179,8,0.4)',
              ],
            }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
            className="flex h-24 w-24 flex-col items-center justify-center rounded-full border-2 border-yellow-200 bg-gradient-to-br from-yellow-300 via-orange-500 to-red-600 shadow-2xl shadow-yellow-500/40"
          >
            <div className="flex h-[4.5rem] w-[4.5rem] flex-col items-center justify-center rounded-full border border-dashed border-orange-400/50 bg-slate-950/85">
              <span className="font-mono text-[9px] font-black leading-none tracking-wider text-parallax-accent">
                AGENT
              </span>
              <span className="mt-1 text-[10px] font-bold tracking-tight text-white">NEXUS</span>
            </div>
          </motion.div>
          <div className="mt-2.5 rounded-full border border-slate-800 bg-slate-950/90 px-3 py-1 text-center font-mono text-[9.5px] text-yellow-400 shadow-md">
            Parallax Agent Core
          </div>
        </div>

        {/* Tilted orbital plane */}
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateX(${ORBITAL_TILT_DEG}deg) rotateY(${ORBITAL_TILT_Y_DEG}deg)`,
          }}
        >
          {ORBITAL_PHASES.map((phase) => {
            const ringSize = phase.radius * 2;
            const isPaused = hoveredStep === phase.id;
            const isActive = activeStep === phase.id;
            const isHovered = hoveredStep === phase.id;
            const isSelected = selectedStep === phase.id;

            return (
              <div key={phase.id}>
                {/* Static dashed orbit ring */}
                <div
                  className={cn(
                    'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed',
                    phase.orbitRingClass,
                  )}
                  style={{
                    width: ringSize,
                    height: ringSize,
                    transformStyle: 'preserve-3d',
                  }}
                />

                {/* Framer Motion orbit rotator — SchemeSeven pattern */}
                <motion.div
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                  style={{
                    width: ringSize,
                    height: ringSize,
                    transformStyle: 'preserve-3d',
                    rotate: phase.startAngle,
                  }}
                  animate={
                    isPaused
                      ? { rotate: phase.startAngle }
                      : { rotate: phase.startAngle + 360 }
                  }
                  transition={{
                    duration: phase.orbitSpeedSec,
                    repeat: isPaused ? 0 : Infinity,
                    ease: 'linear',
                  }}
                >
                  <PlanetNode
                    phase={phase}
                    isActive={isActive}
                    isHovered={isHovered}
                    isSelected={isSelected}
                    onHoverStart={() => onHoverStep(phase.id)}
                    onHoverEnd={() => onHoverStep(null)}
                    onSelect={() => onSelectStep(phase.id)}
                  />
                </motion.div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
