import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300;

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8787';
const PROXY_TIMEOUT_MS = 5 * 60 * 1000;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.text();

  try {
    const response = await fetch(`${BACKEND_URL}/api/run-correlation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
    });

    const payload = await response.text();
    return new NextResponse(payload, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Backend proxy failed';
    return NextResponse.json({ error: message, success: false, logs: [] }, { status: 502 });
  }
}
