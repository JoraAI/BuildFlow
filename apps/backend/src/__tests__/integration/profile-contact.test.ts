/**
 * Self-serve profile email/phone updates with OTP.
 */
import { prisma } from '../../lib/prisma';
import { isSyntheticPhoneEmail } from '@buildflow/shared';
import {
  authGet,
  authPatch,
  authPost,
  registerInventoryAndLogin,
} from './test-helpers';

describe('profile contact (email/phone)', () => {
  let token: string;
  let companyId: string;
  let phone: string;
  const suffix = `pc${Date.now().toString().slice(-6)}`;

  beforeAll(async () => {
    const res = await registerInventoryAndLogin({
      suffix,
      companyName: `Profile Contact Co ${suffix}`,
    });
    token = res.token;
    companyId = res.companyId;
    phone = res.phone;
  });

  afterAll(async () => {
    if (!companyId) return;
    try {
      const users = await prisma.user.findMany({
        where: { companyId },
        select: { id: true },
      });
      const userIds = users.map((u) => u.id);
      // Audit middleware writes async after 2xx; delete twice so late inserts don't block user cleanup.
      await prisma.auditLog.deleteMany({
        where: { OR: [{ companyId }, { userId: { in: userIds } }] },
      });
      await prisma.project.deleteMany({ where: { companyId } });
      await prisma.auditLog.deleteMany({
        where: { OR: [{ companyId }, { userId: { in: userIds } }] },
      });
      await prisma.user.deleteMany({ where: { companyId } });
      await prisma.company.deleteMany({ where: { id: companyId } });
    } catch {
      // best-effort cleanup
    }
  });

  it('phone signup starts with synthetic email', async () => {
    const me = await authGet(token, '/api/settings/me');
    expect(me.status).toBe(200);
    expect(isSyntheticPhoneEmail(me.body.data.email)).toBe(true);
    expect(String(me.body.data.phone ?? '')).toContain(phone.slice(-8));
  });

  it('rejects email change without OTP', async () => {
    const res = await authPatch(token, '/api/settings/me', {
      email: `owner.${suffix}@example.com`,
    });
    expect(res.status).toBe(400);
  });

  it('replaces synthetic email after contact OTP', async () => {
    const email = `owner.${suffix}@example.com`;
    const otpRes = await authPost(token, '/api/settings/me/contact-otp', {
      channel: 'email',
      destination: email,
    });
    expect(otpRes.status).toBe(200);
    expect(otpRes.body.data.sent).toBe(true);

    const patch = await authPatch(token, '/api/settings/me', {
      email,
      emailOtp: '111111',
    });
    expect(patch.status).toBe(200);
    expect(patch.body.data.email).toBe(email);
    expect(isSyntheticPhoneEmail(patch.body.data.email)).toBe(false);

    const me = await authGet(token, '/api/settings/me');
    expect(me.body.data.email).toBe(email);
  });

  it('allows name-only update without OTP', async () => {
    const res = await authPatch(token, '/api/settings/me', {
      name: `Updated Owner ${suffix}`,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toContain('Updated Owner');
  });
});
