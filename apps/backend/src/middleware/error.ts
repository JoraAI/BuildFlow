/**
 * BuildFlow - Global error handler + 404 handler.
 *
 * Mounted last in app.ts. Converts any thrown error into the standard envelope.
 */
import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { ApiError } from '../utils/errors';
import { fail } from '../utils/response';
import { logger } from '../config/logger';
import { env } from '../config/env';

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Resource not found' },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isPayloadTooLarge(err: any): boolean {
  return (
    err?.type === 'entity.too.large' ||
    err?.status === 413 ||
    err?.statusCode === 413 ||
    err?.name === 'PayloadTooLargeError'
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isJsonParseError(err: any): boolean {
  return err?.type === 'entity.parse.failed' || err?.name === 'SyntaxError';
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  // Zod errors (thrown directly somewhere without validate middleware)
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({ field: e.path.join('.'), message: e.message }));
    fail(res, ApiError.validation(details));
    return;
  }

  // Known API errors
  if (err instanceof ApiError) {
    fail(res, err);
    return;
  }

  // Prisma known errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002 = unique constraint violation
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[] | undefined) ?? [];
      if (target.some((field) => field.includes('po_number'))) {
        fail(res, ApiError.conflict('This PO number is already in use. Choose a different number.'));
        return;
      }
      if (target.some((field) => field.includes('grn_number'))) {
        fail(res, ApiError.conflict('This GRN number is already in use. Choose a different number.'));
        return;
      }
      fail(res, ApiError.conflict(`Duplicate value for: ${target.join(', ') || 'field'}`));
      return;
    }
    // P2025 = record not found
    if (err.code === 'P2025') {
      fail(res, ApiError.notFound('Record not found'));
      return;
    }
    // P2003 = foreign key violation
    if (err.code === 'P2003') {
      fail(
        res,
        ApiError.validation([
          { field: 'reference', message: 'Referenced record does not exist' },
        ]),
      );
      return;
    }
  }

  // Prisma validation errors (malformed data)
  if (err instanceof Prisma.PrismaClientValidationError) {
    fail(
      res,
      ApiError.validation([{ field: 'data', message: 'Invalid data provided' }]),
    );
    return;
  }

  // Body too large (file uploads)
  if (isPayloadTooLarge(err)) {
    fail(res, ApiError.validation([{ field: 'file', message: 'File too large (max 10MB)' }]));
    return;
  }

  // Malformed JSON body
  if (isJsonParseError(err)) {
    fail(res, ApiError.badRequest('Malformed JSON in request body'));
    return;
  }

  // Unknown - log full detail, return generic 500
  logger.error('Unhandled error', {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  fail(
    res,
    ApiError.internal(
      env.NODE_ENV === 'production'
        ? 'Something went wrong'
        : err instanceof Error
          ? err.message
          : 'Unknown error',
    ),
  );
}
