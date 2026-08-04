/**
 * Change order integration tests - approval updates BOQ + budget.
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

  it('approving variation linked to WO bumps WO contractValue in summary', async () => {
    const woRes = await authGet(token, `/api/projects/${projectId}/subcontract/work-orders`);
    const wo = (woRes.body.data as Array<{ id: string; woNumber: string }>).find(
      (w) => w.woNumber === 'WO-001',
    );
    expect(wo).toBeTruthy();

    const summaryBefore = await authGet(
      token,
      `/api/projects/${projectId}/subcontract/work-orders/${wo!.id}/summary`,
    );
    const contractBefore = Number(summaryBefore.body.data.contractValue);

    const createRes = await authPost(token, `/api/projects/${projectId}/change-orders`, {
      number: `VO-WO-${Date.now()}`,
      title: 'WO contract bump test',
      reason: 'Integration test',
      linkedWorkOrderId: wo!.id,
      scheduleImpactDays: 0,
      lines: [
        {
          description: 'Extra scope on WO',
          unit: 'Nos',
          qtyDelta: 1,
          rate: 5000,
        },
      ],
    });
    expect(createRes.status).toBe(201);
    const coId = createRes.body.data.id as string;
    const costImpact = Number(createRes.body.data.costImpact);

    await authPost(token, `/api/projects/${projectId}/change-orders/${coId}/submit`);
    const approveRes = await authPost(token, `/api/projects/${projectId}/change-orders/${coId}/approve`);
    expect(approveRes.status).toBe(200);

    const summaryAfter = await authGet(
      token,
      `/api/projects/${projectId}/subcontract/work-orders/${wo!.id}/summary`,
    );
    expect(Number(summaryAfter.body.data.contractValue)).toBe(contractBefore + costImpact);
    expect(Number(summaryAfter.body.data.variationTotal)).toBeGreaterThanOrEqual(costImpact);
  });

  // VO-B1/B6/B7: Approve updates BOQ qty; impact endpoint returns changes.
  it('approve increases linked BOQ qty and impact endpoint shows the change', async () => {
    const boqRes = await authGet(token, `/api/projects/${projectId}/boq`);
    expect(boqRes.status).toBe(200);
    const boqItem = boqRes.body.data?.items?.find(
      (b: { executedQty?: number }) => (b.executedQty ?? 0) === 0,
    );
    expect(boqItem).toBeTruthy();
    const qtyBefore = Number(boqItem.quantity);

    const createRes = await authPost(token, `/api/projects/${projectId}/change-orders`, {
      number: `VO-IMPACT-${Date.now()}`,
      title: 'Impact test variation',
      reason: 'Integration test',
      scheduleImpactDays: 0,
      lines: [
        {
          boqItemId: boqItem.id,
          description: 'Qty bump for impact test',
          unit: boqItem.unit,
          qtyDelta: 5,
          rate: Number(boqItem.rate),
        },
      ],
    });
    expect(createRes.status).toBe(201);
    const coId = createRes.body.data.id as string;

    await authPost(token, `/api/projects/${projectId}/change-orders/${coId}/submit`);
    const approveRes = await authPost(token, `/api/projects/${projectId}/change-orders/${coId}/approve`);
    expect(approveRes.status).toBe(200);

    // VO-B1: Impact endpoint
    const impactRes = await authGet(token, `/api/projects/${projectId}/change-orders/${coId}/impact`);
    expect(impactRes.status).toBe(200);
    const impact = impactRes.body.data;
    expect(impact.boqChanges.length).toBeGreaterThan(0);
    const change = impact.boqChanges.find((c: { boqItemId: string }) => c.boqItemId === boqItem.id);
    expect(change).toBeTruthy();
    expect(change.qtyAfter).toBe(qtyBefore + 5);
    expect(change.qtyBefore).toBe(qtyBefore);
  });

  // VO-B4: Scope summary endpoint returns correct totals.
  it('scope-summary returns original estimate + approved variation totals', async () => {
    const res = await authGet(token, `/api/projects/${projectId}/scope-summary`);
    expect(res.status).toBe(200);
    const summary = res.body.data;
    expect(summary).toHaveProperty('originalEstimateTotal');
    expect(summary).toHaveProperty('approvedVariationTotal');
    expect(summary).toHaveProperty('revisedScopeTotal');
    expect(summary).toHaveProperty('currentBoqTotal');
    expect(summary.revisedScopeTotal).toBe(
      summary.originalEstimateTotal + summary.approvedVariationTotal,
    );
  });
});
