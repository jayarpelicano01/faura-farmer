import { handlers } from '@/lib/auth';
import { requireTrustedOrigin } from '@/lib/security';
import type { NextRequest } from 'next/server';

export const GET = handlers.GET;

export async function POST(request: NextRequest) {
  const originFailure = requireTrustedOrigin(request);
  if (originFailure) return originFailure;
  return handlers.POST(request);
}
