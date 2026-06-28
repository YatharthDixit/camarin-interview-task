import jwt from 'jsonwebtoken';
import { env } from './env.js';

export interface TokenPayload {
  sub: string;
  email: string;
}

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: env.JWT_ACCESS_EXPIRY as any,
  });
}

export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: env.JWT_REFRESH_EXPIRY as any,
  });
}

export function verifyToken(token: string): TokenPayload {
  // Always pin algorithms to prevent alg:none / algorithm confusion attacks
  return jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as TokenPayload;
}
