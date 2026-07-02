'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useWalletClient, useAccount } from 'wagmi';
import { CheckCircle2, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { submitOnChainFeedback } from '@/lib/feedback';
import { EXPLORER_URL, PARALLAX_AGENT_ID } from '@/lib/config';
import type { ReputationSummary } from '@/lib/api';

export function ReputationFeedback({
  eventId,
  disabled,
  reputation,
  onSubmitted,
}: {
  eventId: string;
  disabled: boolean;
  reputation: ReputationSummary | null;
  onSubmitted: () => void;
}) {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [score, setScore] = useState([88]);
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!walletClient) {
      setError('Connect wallet on Mantle Sepolia first.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const hash = await submitOnChainFeedback(walletClient, {
        value: score[0],
        eventId,
        text: `Prediction accuracy ${score[0]}/100 for ${eventId}`,
      });
      setTxHash(hash);
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-zinc-200">
      <CardHeader>
        <CardTitle>Rate Parallax&apos;s Prediction Accuracy</CardTitle>
        <CardDescription>Powered by ERC-8004 · Mantle Sepolia</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between rounded-lg bg-zinc-50 px-4 py-3">
          <div>
            <p className="text-sm text-zinc-500">Current reputation</p>
            <p className="text-2xl font-bold text-zinc-900">
              {reputation?.averageValue ? reputation.averageValue.toFixed(1) : '—'}
              <span className="ml-1 text-sm font-normal text-zinc-500">/ 100</span>
            </p>
          </div>
          <Badge variant="outline">{reputation?.count ?? 0} feedback</Badge>
        </div>

        <div>
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-zinc-600">Your score</span>
            <span className="font-semibold text-zinc-900">{score[0]}</span>
          </div>
          <Slider
            value={score}
            onValueChange={setScore}
            min={1}
            max={100}
            step={1}
            disabled={disabled || !isConnected || Boolean(txHash)}
          />
        </div>

        {txHash ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3"
          >
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-800">Verified on Mantle</span>
            <a
              href={`${EXPLORER_URL}/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-emerald-700 underline"
            >
              View tx <ExternalLink className="h-3 w-3" />
            </a>
          </motion.div>
        ) : (
          <Button
            variant="default"
            className="w-full sm:w-auto"
            disabled={disabled || !isConnected || loading}
            onClick={handleSubmit}
          >
            {loading ? 'Submitting…' : 'Submit On-chain Feedback'}
          </Button>
        )}

        {!isConnected && <p className="text-sm text-zinc-500">Connect wallet to submit feedback.</p>}
        {address && <p className="font-mono text-xs text-zinc-400">Agent {PARALLAX_AGENT_ID}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </CardContent>
    </Card>
  );
}
