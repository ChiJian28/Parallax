'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { ReportPaywall } from '@/components/report/report-paywall';
import { ReputationFeedback } from '@/components/reputation/reputation-feedback';
import { FadeIn } from '@/components/motion/animated-border';
import { DEV_BYPASS, PARALLAX_AGENT_ID } from '@/lib/config';
import {
  fetchReportTeaser,
  fetchReportUnlocked,
  fetchReputation,
  type ReportFull,
  type ReportTeaser,
  type ReputationSummary,
} from '@/lib/api';

export default function ReportPage() {
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId;
  const [teaser, setTeaser] = useState<ReportTeaser | null>(null);
  const [full, setFull] = useState<ReportFull | null>(null);
  const [reputation, setReputation] = useState<ReputationSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [t, r] = await Promise.all([
        fetchReportTeaser(eventId),
        fetchReputation(PARALLAX_AGENT_ID),
      ]);
      setTeaser(t);
      setReputation(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleUnlock = async () => {
    setLoading(true);
    setError(null);
    try {
      if (DEV_BYPASS) {
        const data = await fetchReportUnlocked(eventId);
        setFull(data);
        setTeaser(data);
        return;
      }
      setError('Set NEXT_PUBLIC_X402_DEV_BYPASS=true or configure QuestFlow for live x402.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const refreshReputation = async () => {
    try {
      setReputation(await fetchReputation(PARALLAX_AGENT_ID));
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-8 pb-16">
      <FadeIn>
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
          {teaser?.eventName ?? 'Correlation Report'}
        </h1>
        <p className="text-zinc-600">x402-gated deep research · {eventId}</p>
      </FadeIn>

      <ReportPaywall
        teaser={teaser}
        full={full}
        isPaid={Boolean(full?.fullContent)}
        loading={loading}
        priceMNT={teaser?.priceMNT ?? 2}
        onUnlock={handleUnlock}
      />

      <ReputationFeedback
        eventId={eventId}
        disabled={!full?.fullContent}
        reputation={reputation}
        onSubmitted={refreshReputation}
      />

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
