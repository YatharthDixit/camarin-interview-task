import type { Request, Response } from 'express';
import { prisma } from '@camarin/db';
import { ok } from '../lib/response.js';
import { asyncHandler } from '../lib/async-handler.js';
import { redisConnection } from '../lib/queue.js';

/** Liveness: is the process up? */
export const healthz = asyncHandler(async (_req: Request, res: Response) => {
  ok(res, { status: 'ok', timestamp: new Date().toISOString() });
});

/** Readiness: can the process serve traffic? (Postgres + Redis reachable) */
export const readyz = asyncHandler(async (_req: Request, res: Response) => {
  const checks: Record<string, string> = {};

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks['postgres'] = 'ok';
  } catch {
    checks['postgres'] = 'unreachable';
  }

  try {
    const pong = await redisConnection.ping();
    checks['redis'] = pong === 'PONG' ? 'ok' : 'unhealthy';
  } catch {
    checks['redis'] = 'unreachable';
  }

  const healthy = Object.values(checks).every((v) => v === 'ok');

  res.status(healthy ? 200 : 503).json({
    data: { status: healthy ? 'ready' : 'degraded', checks },
  });
});
