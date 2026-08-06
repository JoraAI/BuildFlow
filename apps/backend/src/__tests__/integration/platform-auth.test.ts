/**
 * Platform admin auth integration tests.
 */
import request from 'supertest';
import { app } from '../../app';

describe('Platform admin auth (integration)', () => {
  it('POST /api/platform/auth/login returns token for seeded admin', async () => {
    const res = await request(app)
      .post('/api/platform/auth/login')
      .send({ email: 'admin@buildflow.com', password: 'Admin@1234' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.admin.email).toBe('admin@buildflow.com');
  });

  it('GET /api/platform/auth/me requires platform token', async () => {
    const login = await request(app)
      .post('/api/platform/auth/login')
      .send({ email: 'admin@buildflow.com', password: 'Admin@1234' });

    const token = login.body.data.accessToken as string;

    const me = await request(app)
      .get('/api/platform/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe('admin@buildflow.com');
  });
});
