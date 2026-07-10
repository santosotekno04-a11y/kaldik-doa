import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const PROXY_URL = process.env.PORTAL_PROXY_URL || '';
const API_KEY = process.env.PORTAL_API_KEY || '';

async function callProxy(action: string, params: Record<string, unknown> = {}) {
  if (!PROXY_URL) {
    return { error: 'Portal proxy URL not configured. Set PORTAL_PROXY_URL in .env.local' };
  }

  try {
    const resp = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: API_KEY, action, ...params }),
    });

    if (!resp.ok) {
      return { error: `Proxy returned ${resp.status}` };
    }

    return await resp.json();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to connect to Portal proxy';
    return { error: msg };
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, ...params } = body;

  if (!action) {
    return NextResponse.json({ error: 'action is required' }, { status: 400 });
  }

  const result = await callProxy(action, params);
  return NextResponse.json(result);
}
