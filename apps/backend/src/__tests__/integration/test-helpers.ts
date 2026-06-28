/**
 * Integration test helpers - login and fetch seeded fixtures.
 */
import request from 'supertest';
import { app } from '../../app';

export async function loginAs(email: string, password = 'Test@1234'): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.data.accessToken as string;
}

export function authGet(token: string, path: string) {
  return request(app).get(path).set('Authorization', `Bearer ${token}`);
}

export function authPost(token: string, path: string, body?: object) {
  const req = request(app).post(path).set('Authorization', `Bearer ${token}`);
  return body !== undefined ? req.send(body) : req.send({});
}

export async function getSeedProjectId(token: string): Promise<string> {
  const res = await authGet(token, '/api/projects');
  if (res.status !== 200 || !res.body.data?.length) {
    throw new Error('No projects in seed data - run pnpm db:seed first');
  }
  const nh65 = res.body.data.find((p: { code: string }) => p.code === 'NH65');
  return (nh65 ?? res.body.data[0]).id as string;
}
