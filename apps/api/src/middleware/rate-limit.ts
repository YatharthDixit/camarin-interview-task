import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import type { Redis } from 'ioredis';
import { env } from '../lib/env.js';

export function createGeneralLimiter(redisClient: Redis) {
  return rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.RATE_LIMIT_GENERAL_MAX,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    store: new RedisStore({
      // @ts-expect-error RedisReply type incompatibility between packages
      sendCommand: (...args: string[]) => redisClient.call(args[0], ...args.slice(1)),
    }),
    message: { error: { code: 'RATE_LIMITED', message: 'Too many requests, try again later' } },
  });
}

export function createAuthLimiter(redisClient: Redis) {
  return rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.RATE_LIMIT_AUTH_MAX,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    store: new RedisStore({
      // @ts-expect-error RedisReply type incompatibility between packages
      sendCommand: (...args: string[]) => redisClient.call(args[0], ...args.slice(1)),
    }),
    message: { error: { code: 'RATE_LIMITED', message: 'Too many auth attempts, try again later' } },
  });
}
