/**
 * SUB-PLAN1: Subscription plan limit enforcement integration tests.
 */
import { loginAs, authPost, getSeedProjectId } from './test-helpers';
import { prisma } from '../../lib/prisma';

const OWNER = 'owner@reddyconst.com';

describe('SUB-PLAN1 Subscription limits (integration)', () => {
  let token: string;
  let companyId: string;
  let originalPlan: string;
  let originalStatus: string;

  beforeAll(async () => {
    token = await loginAs(OWNER);
    const projectId = await getSeedProjectId(token);
    const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    companyId = project.companyId;
    const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    originalPlan = company.subscriptionPlan;
    originalStatus = company.subscriptionStatus;
  });

  afterAll(async () => {
    // Restore original plan and clean up test projects
    await prisma.project.deleteMany({
      where: { companyId, code: { in: ['SUBTEST1', 'STTEST2', 'STTEST3', 'STTEST4'] } },
    });
    await prisma.company.update({
      where: { id: companyId },
      data: { subscriptionPlan: originalPlan as any, subscriptionStatus: originalStatus as any },
    });
  });

  it('PROFESSIONAL plan allows creating additional projects', async () => {
    const res = await authPost(token, '/api/projects', {
      name: 'SUB-PLAN1 Test Project',
      code: 'SUBTEST1',
      type: 'MINI',
      clientName: 'Test Client',
    });
    expect(res.status).toBe(201);
  });

  it('STARTER plan blocks creating 4th project (limit: 3)', async () => {
    // Clean up ALL non-seed projects from other test files or previous runs
    await prisma.project.deleteMany({
      where: { companyId, code: { not: 'NH45' } },
    });

    await prisma.company.update({
      where: { id: companyId },
      data: { subscriptionPlan: 'STARTER', subscriptionStatus: 'ACTIVE' },
    });

    const p2 = await authPost(token, '/api/projects', {
      name: 'STARTER Test 2', code: 'STTEST2', type: 'MINI', clientName: 'Test Client',
    });
    expect(p2.status).toBe(201);

    const p3 = await authPost(token, '/api/projects', {
      name: 'STARTER Test 3', code: 'STTEST3', type: 'MINI', clientName: 'Test Client',
    });
    expect(p3.status).toBe(201);

    // 4th project should be blocked (STARTER max = 3)
    const p4 = await authPost(token, '/api/projects', {
      name: 'STARTER Test 4', code: 'STTEST4', type: 'MINI', clientName: 'Test Client',
    });
    expect(p4.status).toBe(402);
    expect(p4.body.error?.message ?? p4.body.message).toMatch(/STARTER.*3.*projects/i);
  });

  it('STARTER plan blocks inviting 6th user (limit: 5)', async () => {
    // Deactivate all but 4 non-owner users (5 active = STARTER limit)
    const nonOwners = await prisma.user.findMany({
      where: { companyId, role: { not: 'OWNER' } },
      select: { id: true },
      take: 4,
    });
    const deactivateIds = (
      await prisma.user.findMany({
        where: { companyId, role: { not: 'OWNER' }, id: { notIn: nonOwners.map(u => u.id) } },
        select: { id: true },
      })
    ).map(u => u.id);

    expect(deactivateIds.length).toBeGreaterThan(0);

    await prisma.user.updateMany({
      where: { id: { in: deactivateIds } },
      data: { isActive: false },
    });

    await prisma.company.update({
      where: { id: companyId },
      data: { subscriptionPlan: 'STARTER', subscriptionStatus: 'ACTIVE' },
    });

    // Call createInvite directly — should throw ApiError 402
    const { createInvite } = await import('../../services/invite.service');
    await expect(
      createInvite(companyId, '00000000-0000-0000-0000-000000000000', {
        email: `test6-limit-${Date.now()}@test.com`,
        role: 'SITE_SUPERVISOR' as any,
      }),
    ).rejects.toThrow(/STARTER.*5.*users/i);

    // Reactivate users
    await prisma.user.updateMany({
      where: { id: { in: deactivateIds } },
      data: { isActive: true },
    });
  });
});
