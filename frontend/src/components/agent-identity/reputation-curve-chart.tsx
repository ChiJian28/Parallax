'use client';

import { motion } from 'framer-motion';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { REPUTATION_CURVE_DATA } from '@/lib/agent-identity-mocks';

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="glass rounded-lg border border-parallax-accent/30 px-3 py-2 font-mono text-xs shadow-lg">
      <p className="text-parallax-fg-muted">{label}</p>
      <p className="mt-0.5 text-parallax-accent">{payload[0].value.toFixed(1)}% accuracy</p>
    </div>
  );
}

export function ReputationCurveChart() {
  const latest = REPUTATION_CURVE_DATA[REPUTATION_CURVE_DATA.length - 1].accuracy;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
      className="glass flex h-full flex-col rounded-xl"
    >
      <div className="flex items-start justify-between border-b border-parallax-border-glass px-5 py-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-parallax-accent">
            Reputation Curve
          </p>
          <p className="mt-1 text-sm text-parallax-fg-muted">
            Historical prediction accuracy (ERC-8004 feedback aggregate)
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-2xl font-semibold text-parallax-accent">{latest}%</p>
          <p className="font-mono text-[10px] text-parallax-fg-muted">current score</p>
        </div>
      </div>

      <div className="flex-1 px-2 py-4 sm:px-4">
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={REPUTATION_CURVE_DATA} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="reputationFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00FFCC" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#00FFCC" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke="rgba(255,255,255,0.06)"
              strokeDasharray="4 4"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fill: '#8b919a', fontSize: 11, fontFamily: 'var(--font-mono)' }}
              axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
              tickLine={false}
            />
            <YAxis
              domain={[65, 100]}
              tick={{ fill: '#8b919a', fontSize: 11, fontFamily: 'var(--font-mono)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
              width={42}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(0,255,204,0.2)' }} />
            <Area
              type="monotone"
              dataKey="accuracy"
              stroke="#00FFCC"
              strokeWidth={2.5}
              fill="url(#reputationFill)"
              dot={{ r: 3, fill: '#0B0C10', stroke: '#00FFCC', strokeWidth: 2 }}
              activeDot={{ r: 5, fill: '#00FFCC', stroke: '#0B0C10', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
