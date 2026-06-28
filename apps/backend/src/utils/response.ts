/**
 * BuildFlow - Response helpers matching the standard API envelope.
 *
 *   Success (single): { success: true, data: {...} }
 *   Success (list):   { success: true, data: [...], meta: {...} }
 *   Error:            { success: false, error: { code, message, details } }
 */
import { Response } from 'express';
import type { ApiMeta } from '@buildflow/shared';
import { ApiError } from './errors';

type SuccessEnvelope<T> = { success: true; data: T; meta?: ApiMeta };
type ErrorEnvelope = {
  success: false;
  error: { code: string; message: string; details?: unknown };
};

export function ok<T>(res: Response, data: T, status = 200): Response {
  const body: SuccessEnvelope<T> = { success: true, data };
  return res.status(status).json(body);
}

export function okList<T>(
  res: Response,
  data: T[],
  meta: ApiMeta,
  status = 200,
): Response {
  const body: SuccessEnvelope<T[]> = { success: true, data, meta };
  return res.status(status).json(body);
}

export function created<T>(res: Response, data: T): Response {
  return ok(res, data, 201);
}

export function fail(res: Response, err: ApiError): Response {
  const body: ErrorEnvelope = {
    success: false,
    error: {
      code: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    },
  };
  return res.status(err.statusCode).json(body);
}

/** Build standard pagination metadata. */
export function buildMeta(page: number, limit: number, total: number): ApiMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}