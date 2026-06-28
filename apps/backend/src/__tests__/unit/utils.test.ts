/**
 * BuildFlow - Unit tests for pure utils (no DB required).
 */
import jwt from 'jsonwebtoken';
import { ApiError } from '../../utils/errors';
import { signAccessToken, verifyAccessToken } from '../../utils/jwt';

describe('ApiError', () => {
  it('sets correct status code per factory', () => {
    expect(ApiError.notFound().statusCode).toBe(404);
    expect(ApiError.forbidden().statusCode).toBe(403);
    expect(ApiError.conflict().statusCode).toBe(409);
    expect(ApiError.unauthorized().statusCode).toBe(401);
    expect(ApiError.validation([]).statusCode).toBe(422);
    expect(ApiError.rateLimited().statusCode).toBe(429);
    expect(ApiError.internal().statusCode).toBe(500);
  });

  it('carries code + details', () => {
    const err = ApiError.validation([{ field: 'email', message: 'required' }]);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.details).toEqual([{ field: 'email', message: 'required' }]);
  });

  it('is an Error instance (instanceof works)', () => {
    const err = ApiError.badRequest();
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
  });
});

describe('JWT helpers', () => {
  const payload = { sub: 'user-1', companyId: 'co-1', role: 'OWNER' };

  it('signs + verifies an access token', () => {
    const token = signAccessToken(payload);
    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe('user-1');
    expect(decoded.companyId).toBe('co-1');
    expect(decoded.role).toBe('OWNER');
    expect(decoded.type).toBe('access');
    expect(decoded.tid).toBeTruthy();
  });

  it('throws on token signed with a different secret', () => {
    const token = jwt.sign(payload, 'wrong-secret');
    expect(() => verifyAccessToken(token)).toThrow();
  });

  it('throws on expired token', () => {
    const token = jwt.sign({ ...payload, type: 'access', tid: 'x' }, process.env.JWT_ACCESS_SECRET!, {
      expiresIn: '-1s',
    });
    expect(() => verifyAccessToken(token)).toThrow();
  });
});