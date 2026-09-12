/**
 * Owner signup via email or mobile for Construction + Inventory.
 */
import request from 'supertest';
import { app } from '../../app';
import { prisma } from '../../lib/prisma';

const password = 'Test@1234';
const stamp = Date.now().toString().slice(-6);

function uniqueGstin(n: number): string {
  const dig = String((Number(stamp) + n * 17) % 10000).padStart(4, '0');
  return `36AABCR${dig}A1Z${n}`;
}

describe('owner signup with phone or email', () => {
  const createdCompanyIds: string[] = [];

  afterAll(async () => {
    for (const companyId of createdCompanyIds) {
      try {
        await prisma.project.deleteMany({ where: { companyId } });
        await prisma.user.deleteMany({ where: { companyId } });
        await prisma.company.deleteMany({ where: { id: companyId } });
      } catch {
        // best-effort cleanup
      }
    }
  });

  it('registers construction owner with mobile + password and logs in by phone', async () => {
    const phone = `98${stamp}01`.slice(0, 10);
    const res = await request(app).post('/api/auth/register').send({
      companyName: `Phone Co ${stamp}`,
      gstin: uniqueGstin(1),
      pan: 'AABCR1234A',
      state: 'Telangana',
      ownerName: 'Phone Owner',
      ownerPhone: phone,
      password,
      product: 'construction',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.user.productMode).toBe('construction');
    expect(res.body.data.user.phone).toBeTruthy();
    createdCompanyIds.push(res.body.data.user.companyId);

    const login = await request(app).post('/api/auth/login').send({
      email: phone,
      password,
    });
    expect(login.status).toBe(200);
    expect(login.body.data.user.companyId).toBe(res.body.data.user.companyId);
  });

  it('registers inventory owner with mobile + password', async () => {
    const phone = `97${stamp}02`.slice(0, 10);
    const res = await request(app).post('/api/auth/register').send({
      companyName: `Inv Phone ${stamp}`,
      gstin: uniqueGstin(2),
      pan: 'AABCR1234A',
      state: 'Telangana',
      ownerName: 'Inv Phone Owner',
      ownerPhone: phone,
      password,
      product: 'inventory',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.user.productMode).toBe('inventory');
    expect(res.body.data.user.defaultProjectId).toBeTruthy();
    createdCompanyIds.push(res.body.data.user.companyId);

    const login = await request(app).post('/api/auth/login').send({
      email: phone,
      password,
    });
    expect(login.status).toBe(200);
  });

  it('still registers with email for construction', async () => {
    const email = `owner-email-${stamp}@example.com`;
    const res = await request(app).post('/api/auth/register').send({
      companyName: `Email Co ${stamp}`,
      gstin: uniqueGstin(3),
      pan: 'AABCR1234A',
      state: 'Telangana',
      ownerName: 'Email Owner',
      ownerEmail: email,
      password,
      product: 'construction',
    });
    expect(res.status).toBe(201);
    createdCompanyIds.push(res.body.data.user.companyId);
  });

  it('rejects register without email or phone', async () => {
    const res = await request(app).post('/api/auth/register').send({
      companyName: 'No Contact Co',
      gstin: uniqueGstin(4),
      pan: 'AABCR1234A',
      state: 'Telangana',
      ownerName: 'Nobody',
      password,
      product: 'construction',
    });
    expect(res.status).toBe(422);
  });
});
