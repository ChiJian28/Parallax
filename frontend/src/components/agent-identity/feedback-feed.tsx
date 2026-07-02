'use client';

import { motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
import { ON_CHAIN_FEEDBACK } from '@/lib/agent-identity-mocks';
import { EXPLORER_URL } from '@/lib/config';
import { cn } from '@/lib/utils';

export function FeedbackFeed() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
      className="glass overflow-hidden rounded-xl"
    >
      <div className="border-b border-parallax-border-glass px-5 py-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-parallax-accent">
          On-chain Feedback Feed
        </p>
        <p className="mt-1 text-sm text-parallax-fg-muted">
          ERC-8004 reputation registry · verified post-event ratings
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left">
          <thead>
            <tr className="border-b border-parallax-border-glass font-mono text-[10px] uppercase tracking-wider text-parallax-fg-muted">
              <th className="px-5 py-3 font-medium">Reviewer</th>
              <th className="px-3 py-3 font-medium">Score</th>
              <th className="px-3 py-3 font-medium">Tag</th>
              <th className="px-3 py-3 font-medium">Comment</th>
              <th className="px-5 py-3 text-right font-medium">Tx</th>
            </tr>
          </thead>
          <tbody>
            {ON_CHAIN_FEEDBACK.map((row, index) => (
              <motion.tr
                key={row.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + index * 0.05, duration: 0.3 }}
                className="border-b border-parallax-border-glass/60 transition-colors last:border-0 hover:bg-white/[0.02]"
              >
                <td className="px-5 py-3.5">
                  <div>
                    <p className="font-mono text-xs text-parallax-fg">{row.reviewer}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-parallax-fg-muted">
                      {row.timestamp}
                    </p>
                  </div>
                </td>
                <td className="px-3 py-3.5">
                  <span
                    className={cn(
                      'inline-flex rounded-md border px-2 py-0.5 font-mono text-xs',
                      row.score === row.maxScore
                        ? 'border-parallax-accent/40 bg-parallax-accent/10 text-parallax-accent'
                        : 'border-parallax-border-glass bg-white/5 text-parallax-fg',
                    )}
                  >
                    {row.score}/{row.maxScore}
                  </span>
                </td>
                <td className="px-3 py-3.5">
                  <span className="font-mono text-xs text-parallax-accent/90">{row.tag}</span>
                </td>
                <td className="max-w-xs px-3 py-3.5">
                  <p className="text-sm text-parallax-fg-muted">{row.comment}</p>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <a
                    href={`${EXPLORER_URL}/tx/${row.txHash.replace('…', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-[10px] text-parallax-fg-muted transition-colors hover:text-parallax-accent"
                    onClick={(e) => e.preventDefault()}
                  >
                    {row.txHash}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
