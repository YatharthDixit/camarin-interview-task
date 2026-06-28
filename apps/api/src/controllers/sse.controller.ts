import type { Request, Response } from 'express';
import { Redis as IORedis } from 'ioredis';
import { env } from '../lib/env.js';
import { logger } from '../lib/logger.js';

const HEARTBEAT_INTERVAL_MS = 20_000;

/**
 * SSE endpoint for real-time job status updates.
 * Subscribes to Redis pub/sub channel user:{userId}:jobs.
 */
export function streamJobs(req: Request, res: Response): void {
  const userId = req.user!.id;
  const channel = `user:${userId}:jobs`;

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders();

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  // Subscribe to user's job channel via a dedicated Redis connection
  const subscriber = new IORedis(env.REDIS_URL);

  subscriber.subscribe(channel).catch((err: any) => {
    logger.error({ err, channel }, 'Failed to subscribe to SSE channel');
  });

  subscriber.on('message', (_ch: string, message: string) => {
    res.write(`data: ${message}\n\n`);
  });

  // Heartbeat every 20s — defense against intermediary timeouts
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, HEARTBEAT_INTERVAL_MS);

  // Cleanup on client disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    subscriber.unsubscribe(channel).catch(() => {});
    subscriber.quit().catch(() => {});
    logger.debug({ userId }, 'SSE client disconnected');
  });
}
