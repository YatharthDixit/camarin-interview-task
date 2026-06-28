import { describe, it, expect, vi } from 'vitest';

// Mock @camarin/db
vi.mock('@camarin/db', () => ({
  prisma: { $queryRaw: vi.fn() },
  createUser: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserById: vi.fn(),
  createRefreshTokenRecord: vi.fn(),
  rotateRefreshToken: vi.fn(),
  revokeAllUserTokens: vi.fn(),
  createJob: vi.fn(),
  findJobForUser: vi.fn(),
  listJobsForUser: vi.fn(),
  retryJob: vi.fn(),
  markProcessing: vi.fn(),
  markFailed: vi.fn(),
  markFlaggedCompleted: vi.fn(),
  markCaptionedCompleted: vi.fn(),
}));

// Mock env
vi.mock('../lib/env.js', () => ({
  env: {
    NODE_ENV: 'test',
    PORT: 3000,
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-secret-that-is-at-least-32-characters-long',
    JWT_ACCESS_EXPIRY: '15m',
    JWT_REFRESH_EXPIRY: '30d',
    R2_ACCOUNT_ID: 'test',
    R2_ACCESS_KEY_ID: 'test',
    R2_SECRET_ACCESS_KEY: 'test',
    R2_BUCKET: 'test',
    R2_ENDPOINT: 'https://test.r2.cloudflarestorage.com',
  },
}));

// Mock queue
vi.mock('../lib/queue.js', () => ({
  redisConnection: { ping: vi.fn().mockResolvedValue('PONG'), quit: vi.fn() },
  imageProcessingQueue: { add: vi.fn() },
}));

// Mock logger
vi.mock('../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
}));

// Mock storage
vi.mock('../services/storage.service.js', () => ({
  uploadToR2: vi.fn(),
  getPresignedUrl: vi.fn().mockResolvedValue('https://presigned-url.example.com'),
  deleteFromR2: vi.fn(),
}));

import { signAccessToken, verifyToken } from '../lib/jwt.js';
import jwt from 'jsonwebtoken';

describe('JWT', () => {
  it('should sign and verify a token', () => {
    const payload = { sub: 'user-1', email: 'test@example.com' };
    const token = signAccessToken(payload);
    const decoded = verifyToken(token);

    expect(decoded.sub).toBe('user-1');
    expect(decoded.email).toBe('test@example.com');
  });

  it('should reject a token signed with alg:none', () => {
    // Create a token without proper signing
    const unsafeToken = jwt.sign(
      { sub: 'hacker', email: 'hacker@evil.com' },
      '',
      { algorithm: 'none' as jwt.Algorithm },
    );

    expect(() => verifyToken(unsafeToken)).toThrow();
  });

  it('should reject an expired token', () => {
    const token = jwt.sign(
      { sub: 'user-1', email: 'test@example.com' },
      'test-secret-that-is-at-least-32-characters-long',
      { algorithm: 'HS256', expiresIn: '-1s' },
    );

    expect(() => verifyToken(token)).toThrow();
  });

  it('should reject a token signed with a different secret', () => {
    const token = jwt.sign(
      { sub: 'user-1', email: 'test@example.com' },
      'wrong-secret-that-is-at-least-32-characters',
      { algorithm: 'HS256' },
    );

    expect(() => verifyToken(token)).toThrow();
  });
});

describe('Error handler', () => {
  it('AppError should carry status code and code', async () => {
    const { NotFoundError, ValidationError, UnauthorizedError, ConflictError } = await import(
      '../lib/errors.js'
    );

    const notFound = new NotFoundError();
    expect(notFound.statusCode).toBe(404);
    expect(notFound.code).toBe('NOT_FOUND');

    const validation = new ValidationError('bad input');
    expect(validation.statusCode).toBe(400);
    expect(validation.message).toBe('bad input');

    const unauthorized = new UnauthorizedError();
    expect(unauthorized.statusCode).toBe(401);

    const conflict = new ConflictError();
    expect(conflict.statusCode).toBe(409);
  });
});
