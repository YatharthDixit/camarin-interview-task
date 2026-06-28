import type { Request, Response } from 'express';
import { hash, verify } from '@node-rs/argon2';
import {
  createUser,
  findUserByEmail,
  findUserById,
  createRefreshTokenRecord,
  rotateRefreshToken,
  revokeAllUserTokens,
} from '@camarin/db';
import { signAccessToken, signRefreshToken, verifyToken } from '../lib/jwt.js';
import { setAuthCookies, clearAuthCookies } from '../lib/cookies.js';
import { ok } from '../lib/response.js';
import { ConflictError, UnauthorizedError } from '../lib/errors.js';
import { asyncHandler } from '../lib/async-handler.js';
import type { SignupInput, LoginInput } from '../schemas/auth.schema.js';

// Argon2id params: OWASP baseline m=19456 (19 MiB), t=2, p=1
const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export const signup = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as SignupInput;

  const existing = await findUserByEmail(email);
  if (existing) {
    throw new ConflictError('An account with this email already exists');
  }

  const passwordHash = await hash(password, ARGON2_OPTIONS);
  const user = await createUser(email, passwordHash);

  const tokenPayload = { sub: user.id, email: user.email };
  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken(tokenPayload);

  await createRefreshTokenRecord(user.id, refreshToken);

  setAuthCookies(res, accessToken, refreshToken);
  ok(res, { user: { id: user.id, email: user.email } }, 201);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as LoginInput;

  const user = await findUserByEmail(email);
  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const valid = await verify(user.passwordHash, password);
  if (!valid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const tokenPayload = { sub: user.id, email: user.email };
  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken(tokenPayload);

  await createRefreshTokenRecord(user.id, refreshToken);

  setAuthCookies(res, accessToken, refreshToken);
  ok(res, { user: { id: user.id, email: user.email } });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const oldToken = req.cookies?.refresh_token as string | undefined;

  if (!oldToken) {
    throw new UnauthorizedError('No refresh token provided');
  }

  // Verify JWT signature first
  let payload;
  try {
    payload = verifyToken(oldToken);
  } catch {
    clearAuthCookies(res);
    throw new UnauthorizedError('Invalid refresh token');
  }

  // Generate new tokens before rotation (need the raw refresh token for hashing)
  const newAccessToken = signAccessToken({ sub: payload.sub, email: payload.email });
  const newRefreshToken = signRefreshToken({ sub: payload.sub, email: payload.email });

  const result = await rotateRefreshToken(oldToken, newRefreshToken);

  if (!result.ok) {
    clearAuthCookies(res);
    if (result.reason === 'reuse_detected') {
      throw new UnauthorizedError('Token reuse detected — all sessions revoked');
    }
    throw new UnauthorizedError('Refresh token expired or invalid');
  }

  setAuthCookies(res, newAccessToken, newRefreshToken);
  ok(res, { message: 'Tokens refreshed' });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  if (req.user) {
    await revokeAllUserTokens(req.user.id);
  }
  clearAuthCookies(res);
  ok(res, { message: 'Logged out' });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await findUserById(req.user!.id);
  if (!user) {
    throw new UnauthorizedError('User not found');
  }
  ok(res, { user });
});
