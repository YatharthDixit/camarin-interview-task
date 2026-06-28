import type { Response } from 'express';

export function ok(res: Response, data: unknown, status = 200): void {
  res.status(status).json({ data });
}
