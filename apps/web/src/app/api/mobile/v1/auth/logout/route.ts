import { z } from 'zod';
import { badRequest, ok, unauthorized } from '@/lib/http';
import { mobileApiDisabledResponse, mobileApiIsEnabled } from '@/lib/mobile/availability';
import { authenticateMobileRequest, revokeMobileSession } from '@/lib/mobile/auth';
import { readJsonBody } from '@/lib/security';

const inputSchema = z.object({ refreshToken: z.string().min(40).max(256) }).strict();

export async function POST(request: Request) {
  if (!mobileApiIsEnabled()) return mobileApiDisabledResponse();
  const user = await authenticateMobileRequest(request);
  if (!user) return unauthorized();
  const body = await readJsonBody(request, 16 * 1024);
  if ('response' in body) return body.response;
  const parsed = inputSchema.safeParse(body.data);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input');
  await revokeMobileSession(user.id, parsed.data.refreshToken);
  return ok({ loggedOut: true });
}
