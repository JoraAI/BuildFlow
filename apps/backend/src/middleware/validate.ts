/**
 * BuildFlow - Zod validation middleware factory.
 *
 * Validates body / query / params against provided Zod schemas. On failure, returns
 * 422 with field-level details in the standard error envelope.
 *
 * Usage:
 *   router.post('/', validate({ body: loginSchema }), handler)
 */
import { NextFunction, Request, Response } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ApiError } from '../utils/errors';

type SchemaMap = Partial<{ body: ZodSchema; query: ZodSchema; params: ZodSchema }>;

export function validate(schemas: SchemaMap) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query) as typeof req.query;
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params) as typeof req.params;
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.errors.map((e) => ({
          field: e.path.join('.') || undefined,
          message: e.message,
        }));
        return next(ApiError.validation(details));
      }
      next(err);
    }
  };
}