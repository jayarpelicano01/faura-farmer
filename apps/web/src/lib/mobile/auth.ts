import bcrypt from 'bcryptjs';
import { prisma } from '@faura-farmer/database';
import type { MobileAuthResponse } from '@faura-farmer/types';
import { createOpaqueRefreshToken, hashOpaqueToken, issueAccessToken, REFRESH_TOKEN_DAYS, verifyAccessToken } from './tokens';

const PASSWORD_HASH_ROUNDS = 12;
export const DUMMY_PASSWORD_HASH = '$2a$12$D3FEiDkc5z4jFqw7feB5FufZrYAZP3gIqhRI2GEBqGWXqItX4qgOi';

type MobileUser = { id: string; email: string; name: string | null; sessionVersion: number };

function sessionExpiry() {
  return new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
}

function userResponse(user: MobileUser, sessionId: string, refreshToken: string): MobileAuthResponse {
  const access = issueAccessToken({ sub: user.id, sid: sessionId, sv: user.sessionVersion });
  return {
    accessToken: access.token,
    accessTokenExpiresAt: access.expiresAt,
    refreshToken,
    user: { id: user.id, email: user.email, name: user.name },
  };
}

export async function createMobileSession(user: MobileUser, deviceId: string): Promise<MobileAuthResponse> {
  const refreshToken = createOpaqueRefreshToken();
  const session = await prisma.mobileSession.create({
    data: { userId: user.id, deviceId, sessionVersion: user.sessionVersion, tokenHash: hashOpaqueToken(refreshToken), expiresAt: sessionExpiry() },
    select: { id: true },
  });
  return userResponse(user, session.id, refreshToken);
}

export async function rotateMobileSession(refreshToken: string, deviceId: string): Promise<MobileAuthResponse | null> {
  const currentHash = hashOpaqueToken(refreshToken);
  const replacement = createOpaqueRefreshToken();
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const current = await tx.mobileSession.findUnique({
      where: { tokenHash: currentHash },
      include: { user: { select: { id: true, email: true, name: true, sessionVersion: true } } },
    });
    if (
      !current || current.revokedAt || current.expiresAt <= now || current.deviceId !== deviceId ||
      current.sessionVersion !== current.user.sessionVersion
    ) return null;

    // Conditional revocation makes a raced or replayed refresh token unusable.
    const revoked = await tx.mobileSession.updateMany({
      where: { id: current.id, revokedAt: null, expiresAt: { gt: now } },
      data: { revokedAt: now, lastUsedAt: now },
    });
    if (revoked.count !== 1) return null;
    const next = await tx.mobileSession.create({
      data: { userId: current.userId, deviceId, sessionVersion: current.user.sessionVersion, tokenHash: hashOpaqueToken(replacement), expiresAt: sessionExpiry() },
      select: { id: true },
    });
    return userResponse(current.user, next.id, replacement);
  });
}

export async function revokeMobileSession(userId: string, refreshToken: string) {
  await prisma.mobileSession.updateMany({
    where: { userId, tokenHash: hashOpaqueToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function authenticateMobileRequest(request: Request): Promise<MobileUser | null> {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const payload = verifyAccessToken(header.slice('Bearer '.length).trim());
  if (!payload) return null;
  const session = await prisma.mobileSession.findFirst({
    where: { id: payload.sid, userId: payload.sub, sessionVersion: payload.sv, revokedAt: null, expiresAt: { gt: new Date() } },
    include: { user: { select: { id: true, email: true, name: true, sessionVersion: true } } },
  });
  if (!session || session.user.sessionVersion !== payload.sv) return null;
  void prisma.mobileSession.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
  return session.user;
}

export async function passwordMatches(password: string, passwordHash: string | null | undefined) {
  return bcrypt.compare(password, passwordHash ?? DUMMY_PASSWORD_HASH);
}

export async function maybeUpgradePasswordHash(userId: string, passwordHash: string, password: string) {
  if (bcrypt.getRounds(passwordHash) >= PASSWORD_HASH_ROUNDS) return;
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(password, PASSWORD_HASH_ROUNDS) } });
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, PASSWORD_HASH_ROUNDS);
}
