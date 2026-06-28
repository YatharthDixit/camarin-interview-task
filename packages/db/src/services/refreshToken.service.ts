import { createHash, randomUUID } from 'crypto';
import { prisma } from '../client.js';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Hashes a plain string token using SHA-256 for secure database storage.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Creates a new refresh token family for a user session.
 */
export async function createRefreshTokenRecord(userId: string, token: string) {
  const familyId = randomUUID();
  return prisma.refreshToken.create({
    data: {
      userId,
      familyId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + THIRTY_DAYS_MS),
    },
  });
}

export type RotateResult =
  | { ok: true; userId: string }
  | { ok: false; reason: 'not_found' | 'reuse_detected' };

export async function rotateRefreshToken(
  oldToken: string,
  newToken: string,
): Promise<RotateResult> {
  const tokenHash = hashToken(oldToken);

  const existing = await prisma.refreshToken.findFirst({
    where: { tokenHash, expiresAt: { gt: new Date() } },
  });

  if (!existing) return { ok: false, reason: 'not_found' };

  if (existing.used || existing.revoked) {
    await prisma.refreshToken.updateMany({
      where: { familyId: existing.familyId },
      data: { revoked: true },
    });
    return { ok: false, reason: 'reuse_detected' };
  }

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { used: true },
  });

  await prisma.refreshToken.create({
    data: {
      userId: existing.userId,
      familyId: existing.familyId,
      tokenHash: hashToken(newToken),
      expiresAt: new Date(Date.now() + THIRTY_DAYS_MS),
    },
  });

  return { ok: true, userId: existing.userId };
}

export async function revokeAllUserTokens(userId: string) {
  return prisma.refreshToken.updateMany({
    where: { userId, revoked: false },
    data: { revoked: true },
  });
}

export async function cleanupExpiredTokens() {
  return prisma.refreshToken.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
}
