/**
 * Smoke verification for invite / phone login / create-team-user / delete / cross-org.
 */
import request from 'supertest';
import { app } from '../../app';
import { prisma } from '../../lib/prisma';
import { INVITABLE_ROLES } from '@buildflow/shared';

const suffix = Date.now().toString(36);
const password = 'Test@1234';

describe('team invite & phone auth smoke', () => {
  let authHeader: { Authorization: string };
  let ownerEmail: string;
  let companyId: string;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    const owner = await prisma.user.findFirst({
      where: {
        role: 'OWNER',
        isActive: true,
        company: { subscriptionPlan: { not: 'INVENTORY' } },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!owner) throw new Error('No construction owner in DB');
    ownerEmail = owner.email;
    companyId = owner.companyId;

    const login = await request(app).post('/api/auth/login').send({
      email: owner.email,
      password,
    });
    if (login.status !== 200) {
      throw new Error(`Owner login failed for ${owner.email}: ${login.body?.error?.message}`);
    }
    authHeader = { Authorization: `Bearer ${login.body.data.accessToken}` };
  });

  afterAll(async () => {
    if (createdUserIds.length) {
      await prisma.auditLog.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.projectMember.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.userInvite
      .deleteMany({
        where: {
          OR: [
            { email: { contains: 'verify-' } },
            { phone: { contains: String(Date.now()).slice(0, 4) } },
          ],
        },
      })
      .catch(() => undefined);
  });

  it('rejects legacy SUPERVISOR role (root cause of Validation failed)', async () => {
    const res = await request(app)
      .post('/api/settings/users/invite')
      .set(authHeader)
      .send({ email: `verify-bad-${suffix}@example.com`, role: 'SUPERVISOR' });
    expect(res.status).toBe(422);
  });

  it('invites SITE_SUPERVISOR by email', async () => {
    const email = `verify-ss-${suffix}@example.com`;
    const res = await request(app)
      .post('/api/settings/users/invite')
      .set(authHeader)
      .send({ email, role: 'SITE_SUPERVISOR' });
    expect(res.status).toBe(201);
    expect(res.body.data.inviteUrl).toContain('token=');
  });

  it('phone invite: locked phone + password joins org; login with mobile', async () => {
    const phone = `98${String(Date.now()).slice(-8)}`;
    const invite = await request(app)
      .post('/api/settings/users/invite')
      .set(authHeader)
      .send({ phone, role: 'DPM' });
    expect(invite.status).toBe(201);

    const preview = await request(app).get(
      `/api/auth/invite/${encodeURIComponent(invite.body.data.token)}`,
    );
    expect(preview.status).toBe(200);
    expect(preview.body.data.inviteChannel).toBe('phone');
    expect(preview.body.data.phone).toBeTruthy();

    const accept = await request(app).post('/api/auth/accept-invite').send({
      token: invite.body.data.token,
      name: 'Verify Phone User',
      method: 'password',
      password,
    });
    expect([200, 201]).toContain(accept.status);
    expect(accept.body.data.user.companyId).toBe(companyId);
    expect(accept.body.data.user.phone).toBeTruthy();
    createdUserIds.push(accept.body.data.user.id);

    const phoneLogin = await request(app).post('/api/auth/login').send({
      email: phone,
      password,
    });
    expect(phoneLogin.status).toBe(200);
    expect(phoneLogin.body.data.user.companyId).toBe(companyId);
  });

  it('phone invite: OTP join + OTP login', async () => {
    const phone = `95${String(Date.now()).slice(-8)}`;
    const invite = await request(app)
      .post('/api/settings/users/invite')
      .set(authHeader)
      .send({ phone, role: 'QC' });
    expect(invite.status).toBe(201);
    const token = invite.body.data.token as string;

    const otpSend = await request(app).post('/api/auth/invite/send-otp').send({ token });
    expect(otpSend.status).toBe(200);
    expect(otpSend.body.data.devCode).toMatch(/^\d{6}$/);

    const accept = await request(app).post('/api/auth/accept-invite').send({
      token,
      name: 'OTP Joiner',
      method: 'otp',
      otp: otpSend.body.data.devCode,
    });
    expect([200, 201]).toContain(accept.status);
    createdUserIds.push(accept.body.data.user.id);

    const loginOtpSend = await request(app).post('/api/auth/login/send-otp').send({ phone });
    expect(loginOtpSend.status).toBe(200);
    expect(loginOtpSend.body.data.devCode).toMatch(/^\d{6}$/);

    const otpLogin = await request(app).post('/api/auth/login').send({
      email: phone,
      otp: loginOtpSend.body.data.devCode,
    });
    expect(otpLogin.status).toBe(200);
    expect(otpLogin.body.data.user.name).toBe('OTP Joiner');
  });

  it('creates a user with password and allows email + phone login', async () => {
    const email = `verify-created-${suffix}@example.com`;
    const phone = `97${String(Date.now()).slice(-8)}`;

    const create = await request(app)
      .post('/api/settings/users')
      .set(authHeader)
      .send({
        name: 'Created User',
        email,
        phone,
        password,
        role: 'ACCOUNTANT',
      });
    expect([200, 201]).toContain(create.status);
    expect(create.body.data.loginHint).toBeTruthy();
    createdUserIds.push(create.body.data.id);

    const emailLogin = await request(app).post('/api/auth/login').send({ email, password });
    expect(emailLogin.status).toBe(200);

    const phoneLogin = await request(app).post('/api/auth/login').send({ email: phone, password });
    expect(phoneLogin.status).toBe(200);
  });

  it('deactivated users cannot login; delete frees contact for new-org invite', async () => {
    const phone = `96${String(Date.now()).slice(-8)}`;
    const email = `verify-rejoin-${suffix}@example.com`;

    const create = await request(app)
      .post('/api/settings/users')
      .set(authHeader)
      .send({
        name: 'Rejoin Candidate',
        email,
        phone,
        password,
        role: 'QC',
      });
    expect([200, 201]).toContain(create.status);
    const userId = create.body.data.id as string;
    createdUserIds.push(userId);

    // Deactivate → login blocked
    const deact = await request(app)
      .put(`/api/settings/users/${userId}`)
      .set(authHeader)
      .send({ isActive: false });
    expect(deact.status).toBe(200);

    const blocked = await request(app).post('/api/auth/login').send({ email: phone, password });
    expect(blocked.status).toBe(403);

    // Delete frees phone/email
    const del = await request(app).delete(`/api/settings/users/${userId}`).set(authHeader);
    expect(del.status).toBe(200);

    // Fresh invite + accept into same (or any) org works again
    const invite = await request(app)
      .post('/api/settings/users/invite')
      .set(authHeader)
      .send({ phone, role: 'PM' });
    expect(invite.status).toBe(201);

    const accept = await request(app).post('/api/auth/accept-invite').send({
      token: invite.body.data.token,
      name: 'Fresh Start',
      method: 'password',
      password: 'Fresh@1234',
    });
    expect([200, 201]).toContain(accept.status);
    createdUserIds.push(accept.body.data.user.id);

    const login = await request(app).post('/api/auth/login').send({
      email: phone,
      password: 'Fresh@1234',
    });
    expect(login.status).toBe(200);
    expect(login.body.data.user.name).toBe('Fresh Start');
    expect(login.body.data.user.companyId).toBe(companyId);

    // Old password must not work against the new membership
    const oldPw = await request(app).post('/api/auth/login').send({
      email: phone,
      password,
    });
    expect(oldPw.status).toBe(401);
  });

  it('exposes the full construction invite role set', () => {
    expect(INVITABLE_ROLES).toEqual([
      'PM',
      'DPM',
      'QC',
      'MECHANICAL_MANAGER',
      'STORE_INCHARGE',
      'WEIGHBRIDGE_INCHARGE',
      'SITE_SUPERVISOR',
      'ACCOUNTANT',
    ]);
  });

  it('keeps owner email login working', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: ownerEmail, password });
    expect(res.status).toBe(200);
  });
});
