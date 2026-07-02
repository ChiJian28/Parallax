'use client';

import { motion } from 'framer-motion';
import { Activity, Circle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MacroEventItem } from '@/lib/command-center-mocks';

interface MacroEventFeedProps {
  events: MacroEventItem[];
  selectedId: string;
  onSelect: (id: string) => void;
}

const STATUS_CONFIG = {
  live: {
    label: 'LIVE',
    icon: Activity,
    className: 'text-parallax-accent bg-parallax-accent/10 border-parallax-accent/30',
    dot: 'bg-parallax-accent animate-pulse',
  },
  resolved: {
    label: 'RESOLVED',
    icon: Circle,
    className: 'text-parallax-fg-muted bg-white/5 border-parallax-border-glass',
    dot: 'bg-parallax-fg-muted',
  },
  upcoming: {
    label: 'UPCOMING',
    icon: Clock,
    className: 'text-amber-400/90 bg-amber-400/10 border-amber-400/20',
    dot: 'bg-amber-400',
  },
} as const;

export function MacroEventFeed({ events, selectedId, onSelect }: MacroEventFeedProps) {
  return (
    <aside className="glass flex h-full flex-col rounded-xl">
      <div className="border-b border-parallax-border-glass px-4 py-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-parallax-accent">
          Macro Event Feed
        </p>
        <p className="mt-1 text-xs text-parallax-fg-muted">
          {events.length} triggers monitored
        </p>
      </div>

      <ul className="flex flex-1 flex-col gap-2 p-3">
        {events.map((event, index) => {
          const selected = event.id === selectedId;
          const status = STATUS_CONFIG[event.status];

          return (
            <motion.li
              key={event.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.06, duration: 0.35 }}
            >
              <button
                type="button"
                onClick={() => onSelect(event.id)}
                className={cn(
                  'group w-full rounded-lg border px-3 py-3 text-left transition-all duration-200',
                  selected
                    ? 'border-parallax-accent/50 bg-parallax-accent/5 shadow-[0_0_24px_rgba(0,255,204,0.08)]'
                    : 'border-transparent bg-white/[0.02] hover:border-parallax-border-glass hover:bg-white/[0.04]',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-parallax-fg">{event.title}</span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 font-mono text-[9px] tracking-wider',
                      status.className,
                    )}
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} />
                    {status.label}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-snug text-parallax-fg-muted">
                  {event.subtitle}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-mono text-[10px] text-parallax-fg-muted/70">
                    {event.timestamp}
                  </span>
                  <span className="font-mono text-[10px] text-parallax-accent/70">
                    {event.category}
                  </span>
                </div>
              </button>
            </motion.li>
          );
        })}
      </ul>
    </aside>
  );
}
