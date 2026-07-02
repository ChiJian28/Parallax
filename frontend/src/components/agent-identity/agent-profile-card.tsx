'use client';

import { motion } from 'framer-motion';
import { Fingerprint, Globe2, Shield } from 'lucide-react';
import { OASF_DOMAINS, formatAgentPassportId } from '@/lib/agent-identity-mocks';
import { PARALLAX_AGENT_ID } from '@/lib/config';

export function AgentProfileCard() {
  const passportId = formatAgentPassportId(PARALLAX_AGENT_ID);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="relative h-full"
    >
      <div className="absolute -inset-px rounded-xl bg-gradient-to-br from-parallax-accent/40 via-parallax-accent/10 to-transparent opacity-80 blur-sm" />

      <div className="glass relative flex h-full flex-col overflow-hidden rounded-xl border border-parallax-accent/20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(0,255,204,0.08),transparent_55%)]" />

        <div className="relative border-b border-parallax-border-glass px-5 py-4">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-parallax-accent">
              ERC-8004 Passport
            </p>
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-parallax-accent">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-parallax-accent opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-parallax-accent" />
              </span>
              ACTIVE
            </span>
          </div>
        </div>

        <div className="relative flex flex-1 flex-col gap-5 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-parallax-accent/30 bg-parallax-accent/10">
              <Fingerprint className="h-6 w-6 text-parallax-accent" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-semibold tracking-tight text-parallax-fg">Parallax</p>
              <p className="font-mono text-[10px] text-parallax-fg-muted">Onchain Quant Agent</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-lg border border-parallax-border-glass bg-white/[0.02] px-3 py-2.5">
              <p className="font-mono text-[9px] uppercase tracking-wider text-parallax-fg-muted">
                Agent ID
              </p>
              <p className="mt-1 break-all font-mono text-sm text-parallax-accent">
                {passportId}
              </p>
            </div>

            <div className="rounded-lg border border-parallax-border-glass bg-white/[0.02] px-3 py-2.5">
              <div className="flex items-center gap-1.5">
                <Globe2 className="h-3 w-3 text-parallax-fg-muted" />
                <p className="font-mono text-[9px] uppercase tracking-wider text-parallax-fg-muted">
                  OASF Domain
                </p>
              </div>
              <ul className="mt-2 space-y-1">
                {OASF_DOMAINS.map((domain) => (
                  <li
                    key={domain}
                    className="font-mono text-xs text-parallax-fg"
                  >
                    {domain}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-parallax-border-glass bg-white/[0.02] px-3 py-2.5">
              <div className="flex items-center gap-1.5">
                <Shield className="h-3 w-3 text-parallax-fg-muted" />
                <span className="font-mono text-[9px] uppercase tracking-wider text-parallax-fg-muted">
                  Registry
                </span>
              </div>
              <span className="font-mono text-xs text-parallax-fg">Mantle Sepolia · 5003</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
