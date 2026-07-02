'use client';

import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ReportFull, ReportTeaser } from '@/lib/api';
import { CorrelationChart } from '@/components/report/correlation-chart';

interface ReportPaywallProps {
  teaser: ReportTeaser | null;
  full: ReportFull | null;
  isPaid: boolean;
  loading: boolean;
  priceMNT: number;
  onUnlock: () => void;
}

export function ReportPaywall({
  teaser,
  full,
  isPaid,
  loading,
  priceMNT,
  onUnlock,
}: ReportPaywallProps) {
  const content = full?.fullContent ?? teaser?.teaser ?? '';

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="lg:col-span-2">
        <Card className="h-full border-zinc-200 bg-white">
          <CardHeader>
            <Badge variant="mint" className="w-fit">
              Free Teaser
            </Badge>
            <CardTitle className="mt-2">{teaser?.eventName ?? 'Correlation Report'}</CardTitle>
            <CardDescription>
              {teaser?.teaser ?? 'Load the report to preview macro-to-onchain correlation signals.'}
            </CardDescription>
          </CardHeader>
          {!isPaid && (
            <CardContent>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 text-center shadow-sm">
                <Lock className="mx-auto mb-3 h-8 w-8 text-zinc-400" />
                <p className="text-sm font-medium text-zinc-900">Unlock Deep Correlation Report</p>
                <p className="mt-1 text-2xl font-bold text-zinc-900">{priceMNT} $MNT</p>
                <p className="mt-1 text-xs text-zinc-500">x402 micropayment on Mantle Sepolia</p>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="mt-4">
                  <Button
                    variant="mint"
                    size="lg"
                    className="w-full bg-gradient-to-r from-mantle-mint via-emerald-300 to-mantle-mint bg-[length:200%_100%] animate-shimmer"
                    onClick={onUnlock}
                    disabled={loading}
                  >
                    <Sparkles className="h-4 w-4" />
                    {loading ? 'Processing…' : 'Pay with x402 & Unlock'}
                  </Button>
                </motion.div>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      <div className="relative lg:col-span-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={isPaid ? 'paid' : 'locked'}
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45 }}
            className="relative min-h-[28rem] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
          >
            <motion.div
              animate={{
                filter: isPaid ? 'blur(0px)' : 'blur(10px)',
                y: isPaid ? 0 : 12,
              }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className={isPaid ? 'p-8' : 'pointer-events-none max-h-96 overflow-hidden p-8'}
            >
              <article className="prose prose-zinc max-w-none prose-headings:font-semibold prose-a:text-emerald-700">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              </article>
            </motion.div>

            {!isPaid && (
              <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-zinc-50 via-zinc-50/90 to-transparent pb-8" />
            )}

            {isPaid && full?.computedMetrics && (
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="border-t border-zinc-100 p-6"
              >
                <CorrelationChart report={full} />
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
