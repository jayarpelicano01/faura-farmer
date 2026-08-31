import { createHash } from 'node:crypto';
import { prisma } from '@faura-farmer/database';
import { getClientIp } from './security';

export type SecurityEventName =
  | 'login_failed'
  | 'password_changed'
  | 'password_reset_requested'
  | 'password_reset_completed'
  | 'oauth_sign_in_failed'
  | 'rate_limit_blocked'
  | 'origin_rejected';

export async function recordSecurityEvent(
  event: SecurityEventName,
  options: { request?: Request; userId?: string | null } = {},
) {
  try {
    const ipHash = options.request
      ? createHash('sha256').update(getClientIp(options.request)).digest('hex')
      : null;
    await prisma.securityEvent.create({
      data: { event, userId: options.userId ?? null, ipHash },
    });
  } catch (error) {
    console.error('Unable to record security event', {
      event,
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
}
