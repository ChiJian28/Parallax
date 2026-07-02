'use client';

import { motion } from 'framer-motion';
import { AgentProfileCard } from '@/components/agent-identity/agent-profile-card';
import { ReputationCurveChart } from '@/components/agent-identity/reputation-curve-chart';
import { FeedbackFeed } from '@/components/agent-identity/feedback-feed';

export function AgentIdentity() {
  return (
    <div className="space-y-6">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-1"
      >
        <p className="font-mono text-xs uppercase tracking-widest text-parallax-accent">
          Agent Identity
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-parallax-fg sm:text-3xl">
          ERC-8004 On-Chain Profile
        </h1>
        <p className="text-sm text-parallax-fg-muted">
          Registered agent passport, reputation trajectory, and verified feedback ledger.
        </p>
      </motion.header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-5">
        <div className="lg:col-span-1">
          <AgentProfileCard />
        </div>

        <div className="lg:col-span-2">
          <ReputationCurveChart />
        </div>

        <div className="lg:col-span-3">
          <FeedbackFeed />
        </div>
      </div>
    </div>
  );
}
