import type { LucideIcon } from 'lucide-react';
import { Cpu, Globe, Search, ShieldCheck, Zap } from 'lucide-react';

export interface OrbitalPhase {
  id: number;
  name: string;
  tag: string;
  desc: string;
  description: string;
  colorName: string;
  latency: string;
  bgGradient: string;
  glowColor: string;
  orbitRingClass: string;
  legendDotClass: string;
  icon: LucideIcon;
  orbitSpeedSec: number;
  /** Orbit radius in px — matches SchemeSeven proportions */
  radius: number;
  /** Initial angle on orbit (degrees) */
  startAngle: number;
}

export const ORBITAL_PHASES: OrbitalPhase[] = [
  {
    id: 1,
    name: 'Triggers',
    tag: 'Triggers Layer',
    desc: 'Macro event detection (Fed/CPI)',
    description:
      'Monitors global macroeconomic releases (FRED inflation series, GDP targets) and real-time sentiment shifts.',
    colorName: 'Amber Dust & Solar Flare',
    latency: '128ms',
    bgGradient: 'from-amber-400 via-orange-500 to-yellow-600',
    glowColor: 'rgba(245, 158, 11, 0.6)',
    orbitRingClass: 'border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.1)]',
    legendDotClass: 'bg-amber-500',
    icon: Globe,
    orbitSpeedSec: 14,
    radius: 110,
    startAngle: -90,
  },
  {
    id: 2,
    name: 'Data',
    tag: 'Data Layer',
    desc: 'Mantle agent skills (Data Indexer)',
    description:
      'Determines live state values from Mantle contracts using on-chain data indexers and DeFi operator vaults.',
    colorName: 'Mantle Mint & Deep Ocean',
    latency: '42ms',
    bgGradient: 'from-emerald-400 via-teal-500 to-cyan-600',
    glowColor: 'rgba(0, 255, 204, 0.6)',
    orbitRingClass: 'border-[#00FFCC]/40 shadow-[0_0_15px_rgba(0,255,204,0.1)]',
    legendDotClass: 'bg-[#00FFCC]',
    icon: Search,
    orbitSpeedSec: 22,
    radius: 165,
    startAngle: -18,
  },
  {
    id: 3,
    name: 'Engine',
    tag: 'Engine Layer',
    desc: 'Text-to-SQL & LLM synthesis',
    description:
      'Executes LLM synthesis, text-to-SQL logic, and generates pre/post event baselines matching prediction models.',
    colorName: 'Gas Giant Golden Ochre',
    latency: '96ms',
    bgGradient: 'from-yellow-300 via-amber-500 to-amber-800',
    glowColor: 'rgba(234, 179, 8, 0.6)',
    orbitRingClass: 'border-yellow-500/40 shadow-[0_0_15px_rgba(234,179,8,0.1)]',
    legendDotClass: 'bg-yellow-500',
    icon: Cpu,
    orbitSpeedSec: 30,
    radius: 220,
    startAngle: 54,
  },
  {
    id: 4,
    name: 'Gate',
    tag: 'Gate Layer',
    desc: 'x402 payment gate',
    description:
      'Secures premium report access via x402 micropayments and agent-to-agent reporting fees on Mantle.',
    colorName: 'Crimson Rust',
    latency: '115ms',
    bgGradient: 'from-red-400 via-rose-600 to-red-800',
    glowColor: 'rgba(239, 68, 68, 0.6)',
    orbitRingClass: 'border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.1)]',
    legendDotClass: 'bg-red-500',
    icon: Zap,
    orbitSpeedSec: 38,
    radius: 275,
    startAngle: 126,
  },
  {
    id: 5,
    name: 'Reputation',
    tag: 'Reputation Layer',
    desc: 'ERC-8004 reputation loop',
    description:
      'Locks accuracy scores from post-event feedback, compounding on-chain trust to unlock higher-tier pricing.',
    colorName: 'Saturn Silver Ringlet',
    latency: '60ms',
    bgGradient: 'from-indigo-400 via-purple-500 to-pink-600',
    glowColor: 'rgba(168, 85, 247, 0.6)',
    orbitRingClass: 'border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.1)]',
    legendDotClass: 'bg-purple-500',
    icon: ShieldCheck,
    orbitSpeedSec: 46,
    radius: 330,
    startAngle: 198,
  },
];

export const ORBITAL_MAX_RADIUS = 330;

export function getOrbitalPhase(id: number): OrbitalPhase | undefined {
  return ORBITAL_PHASES.find((p) => p.id === id);
}

export const ORBITAL_TILT_DEG = 64;
export const ORBITAL_TILT_Y_DEG = -3;
export const ORBITAL_PERSPECTIVE_PX = 1100;

/** Billboard transform — cancels parent tilt so planets face the viewer */
export const PLANET_BILLBOARD_TRANSFORM = `rotateX(-${ORBITAL_TILT_DEG}deg) rotateY(${-ORBITAL_TILT_Y_DEG}deg)`;
