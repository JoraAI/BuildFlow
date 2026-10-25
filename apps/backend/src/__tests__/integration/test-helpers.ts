/**
 * Integration test helpers - login and fetch seeded fixtures.
 */
import request from 'supertest';
import { app } from '../../app';

/** Seed / test login uses master OTP 111111 when OTP_MASTER_ENABLED (default in test). */
/** Register an inventory owner on mobile + OTP, then return the session token. */
export async function registerInventoryAndLogin(opts: {
  suffix: string;
  companyName: string;
  ownerName?: string;
  vertical?: 'GENERAL' | 'EVENTS' | 'ICE_CREAM';
}): Promise<{
  token: string;
  userId: string;
  companyId: string;
  defaultProjectId: string;
  phone: string;
}> {
  const digits = opts.suffix.replace(/\D/g, '').padStart(8, '0').slice(-8);
  const phone = `98${digits}`.slice(0, 10);
  const register = await request(app).post('/api/auth/register').send({
    companyName: opts.companyName,
    gstin: `36AABCR${digits.slice(0, 4)}A1Z5`,
    pan: `AABCR${digits.slice(0, 4)}A`,
    state: 'Telangana',
    ownerName: opts.ownerName ?? 'Inventory Owner',
    ownerPhone: phone,
    product: 'inventory',
    inventoryVertical: opts.vertical ?? 'GENERAL',
  });
  if (register.status !== 201) {
    throw new Error(`Inventory register failed: ${register.status} ${JSON.stringify(register.body)}`);
  }
  if (register.body.data.accessToken) {
    throw new Error('Phone register must not issue a session before OTP');
  }
  const token = await loginAs(phone);
  return {
    token,
    userId: register.body.data.user.id as string,
    companyId: register.body.data.user.companyId as string,
    defaultProjectId: register.body.data.user.defaultProjectId as string,
    phone,
  };
}

export async function loginAs(email: string, _passwordIgnored = 'Test@1234'): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, otp: '111111' });
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

export function authPut(token: string, path: string, body?: object) {
  const req = request(app).put(path).set('Authorization', `Bearer ${token}`);
  return body !== undefined ? req.send(body) : req.send({});
}

export function authDelete(token: string, path: string) {
  return request(app).delete(path).set('Authorization', `Bearer ${token}`);
}

export async function getSeedProjectId(token: string): Promise<string> {
  const res = await authGet(token, '/api/projects');
  if (res.status !== 200 || !res.body.data?.length) {
    throw new Error('No projects in seed data - run pnpm db:seed first');
  }
  const nh45 = res.body.data.find((p: { code: string }) => p.code === 'NH45');
  return (nh45 ?? res.body.data[0]).id as string;
}

export async function getProjectId(token: string, code: string): Promise<string> {
  const res = await authGet(token, '/api/projects');
  if (res.status !== 200) throw new Error('Failed to list projects');
  const project = (res.body.data as Array<{ id: string; code: string }>).find((p) => p.code === code);
  if (!project) throw new Error(`Project ${code} not found`);
  return project.id;
}
