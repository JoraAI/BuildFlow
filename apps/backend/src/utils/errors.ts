/**
 * BuildFlow - ApiError class + standard error codes.
 */
export type ErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNPROCESSABLE'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

const HTTP_STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details?: Array<{ field?: string; message: string }>;

  constructor(
    code: ErrorCode,
    message: string,
    opts: { details?: Array<{ field?: string; message: string }>; statusCode?: number } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = opts.statusCode ?? HTTP_STATUS[code];
    this.details = opts.details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  static badRequest(message = 'Bad request'): ApiError {
    return new ApiError('BAD_REQUEST', message);
  }
  static validation(details: Array<{ field?: string; message: string }>): ApiError {
    return new ApiError('VALIDATION_ERROR', 'Validation failed', { details });
  }
  static unauthorized(message = 'Authentication required'): ApiError {
    return new ApiError('UNAUTHORIZED', message);
  }
  static forbidden(message = 'You do not have permission to perform this action'): ApiError {
    return new ApiError('FORBIDDEN', message);
  }
  static notFound(message = 'Resource not found'): ApiError {
    return new ApiError('NOT_FOUND', message);
  }
  static conflict(message = 'Resource already exists'): ApiError {
    return new ApiError('CONFLICT', message);
  }
  static unprocessable(message = 'Unprocessable entity'): ApiError {
    return new ApiError('UNPROCESSABLE', message);
  }
  static rateLimited(message = 'Too many requests'): ApiError {
    return new ApiError('RATE_LIMITED', message);
  }
  static internal(message = 'Something went wrong'): ApiError {
    return new ApiError('INTERNAL_ERROR', message);
  }
}