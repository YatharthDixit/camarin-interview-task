import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';

interface ValidateOptions {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}

/**
 * Middleware factory that validates req.body, req.params, and/or req.query
 * against provided Zod schemas. ZodError propagates to the centralized
 * error-handler which formats it with a per-field `details` array.
 */
export function validate(schemas: ValidateOptions) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params) as Record<string, string>;
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query) as Record<string, string>;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
