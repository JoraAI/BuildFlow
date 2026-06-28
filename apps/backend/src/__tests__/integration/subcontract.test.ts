/**
 * Subcontract integration tests - measurement approval and bill linkage path.
 */
import { loginAs, authGet, authPost, getSeedProjectId } from './test-helpers';

const OWNER = 'owner@reddyconst.com';

describe('Subcontract (integration)', () => {
  let token: string;
  let projectId: string;

  beforeAll(async () => {
    token = await loginAs(OWNER);
    projectId = await getSeedProjectId(token);
  });

  it('lists seeded work order WO-001', async () => {
    const res = await authGet(token, `/api/projects/${projectId}/subcontract/work-orders`);
    expect(res.status).toBe(200);
    expect((res.body.data as Array<{ woNumber: string }>).some((w) => w.woNumber === 'WO-001')).toBe(true);
  });

  it('creates measurement, submits, approves with bill linkage', async () => {
    const woRes = await authGet(token, `/api/projects/${projectId}/subcontract/work-orders`);
    const wo = (woRes.body.data as Array<{ id: string; woNumber: string }>)[0];
    expect(wo).toBeTruthy();

    const createRes = await authPost(
      token,
      `/api/projects/${projectId}/subcontract/work-orders/${wo.id}/measurements`,
      {
        periodLabel: 'Test period',
        lines: [{ description: 'Test work', quantity: 10, unit: 'cum', rate: 500 }],
      },
    );
    expect(createRes.status).toBe(201);
    const measId = createRes.body.data.id as string;

    await authPost(token, `/api/projects/${projectId}/subcontract/measurements/${measId}/submit`);
    const approveRes = await authPost(
      token,
      `/api/projects/${projectId}/subcontract/measurements/${measId}/approve`,
      { createBill: true },
    );
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.measurement?.status ?? approveRes.body.data.status).toBe('APPROVED');
    expect(approveRes.body.data.bill).toBeTruthy();
    expect(approveRes.body.data.bill.measurementId).toBe(measId);
  });
});
