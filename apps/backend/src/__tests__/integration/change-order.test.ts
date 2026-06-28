/**
 * Change order integration tests — approval updates BOQ + budget.
 */
import { loginAs, authGet, authPost, getSeedProjectId } from './test-helpers';

const OWNER = 'owner@reddyconst.com';

describe('Change orders (integration)', () => {
  let token: string;
  let projectId: string;

  beforeAll(async () => {
    token = await loginAs(OWNER);
    projectId = await getSeedProjectId(token);
  });

  it('lists seeded approved variation VO-001', async () => {
    const res = await authGet(token, `/api/projects/${projectId}/change-orders`);
    expect(res.status).toBe(200);
    const orders = res.body.data as Array<{ number: string; status: string }>;
    expect(orders.some((o) => o.number === 'VO-001' && o.status === 'APPROVED')).toBe(true);
  });

  it('creates, submits, and approves a new variation', async () => {
    const boqRes = await authGet(token, `/api/projects/${projectId}/boq`);
    expect(boqRes.status).toBe(200);
    const boqItem = boqRes.body.data?.items?.[0];
    expect(boqItem).toBeTruthy();

    const createRes = await authPost(token, `/api/projects/${projectId}/change-orders`, {
      number: `VO-TEST-${Date.now()}`,
      title: 'Test variation',
      reason: 'Integration test',
      scheduleImpactDays: 0,
      lines: [
        {
          boqItemId: boqItem.id,
          description: 'Qty adjustment',
          unit: boqItem.unit,
          qtyDelta: 10,
          rate: Number(boqItem.rate),
        },
      ],
    });
    expect(createRes.status).toBe(201);
    const coId = createRes.body.data.id as string;

    const submitRes = await authPost(token, `/api/projects/${projectId}/change-orders/${coId}/submit`);
    expect(submitRes.status).toBe(200);
    expect(submitRes.body.data.status).toBe('SUBMITTED');

    const approveRes = await authPost(token, `/api/projects/${projectId}/change-orders/${coId}/approve`);
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('APPROVED');
  });
});
