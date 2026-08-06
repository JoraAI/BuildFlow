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
});