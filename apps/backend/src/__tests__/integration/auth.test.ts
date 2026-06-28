/**
 * Auth route integration tests.
 */
import request from 'supertest';
import { app } from '../../app';

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
  });
});

describe('GET /api/auth/config', () => {
  it('returns public auth config', async () => {
    const res = await request(app).get('/api/auth/config');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.allowPublicCompanyRegistration).toBe('boolean');
  });
});

describe('POST /api/auth/register (validation)', () => {
  it('rejects an invalid payload with 422 + details envelope', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ companyName: '' });
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });

  it('rejects a weak password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        companyName: 'Test Co',
        gstin: '36AABCR1234A1Z5',
        pan: 'AABCR1234A',
        state: 'Telangana',
        ownerName: 'Owner',
        ownerEmail: 'owner@test.com',
        password: 'weak',
      });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/auth/login (validation)', () => {
  it('requires email + password', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(422);
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });
});

describe('POST /api/auth/accept-invite (validation)', () => {
  it('requires token, name, and strong password', async () => {
    const res = await request(app).post('/api/auth/accept-invite').send({});
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/auth/invite/:token', () => {
  it('returns 404 for invalid token', async () => {
    const res = await request(app).get('/api/auth/invite/not-a-valid-token');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/auth/me (unauthenticated)', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('POST /api/settings/users/invite (unauthenticated)', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app)
      .post('/api/settings/users/invite')
      .send({ email: 'test@example.com', role: 'PM' });
    expect(res.status).toBe(401);
  });
});

describe('Unknown route', () => {
  it('returns 404 NOT_FOUND envelope for non-API paths', async () => {
    const res = await request(app).get('/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 401 for unknown API paths (auth shielded)', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
