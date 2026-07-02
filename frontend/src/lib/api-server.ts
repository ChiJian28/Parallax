const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8787';

export interface ReputationSummary {
  agentId: string;
  count: number;
  averageValue: number;
}

export async function fetchReputationServer(agentId: string): Promise<ReputationSummary | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/reputation/${encodeURIComponent(agentId)}`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    return res.json() as Promise<ReputationSummary>;
  } catch {
    return null;
  }
}
