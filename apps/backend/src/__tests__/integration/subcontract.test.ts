/**
 * Subcontract integration tests - summary, retention, BOQ→WO, reject flow.
 */
import request from 'supertest';
import { loginAs, authGet, authPost, authPut, authDelete, getSeedProjectId } from './test-helpers';
import { app } from '../../app';

const OWNER = 'owner@reddyconst.com';

describe('Subcontract (integration)', () => {
  let token: string;
  let projectId: string;

  beforeAll(async () => {
    token = await loginAs(OWNER);
    projectId = await getSeedProjectId(token);
  });

  afterAll(async () => {
    const woRes = await authGet(token, `/api/projects/${projectId}/subcontract/work-orders`);
    const testWo = (woRes.body.data as Array<{ id: string; woNumber: string; _count?: { measurements: number; bills: number } }>).find(
      (w) => w.woNumber === 'WO-TEST-BOQ',
    );
    if (testWo && (testWo._count?.measurements ?? 0) === 0 && (testWo._count?.bills ?? 0) === 0) {
      await authDelete(token, `/api/projects/${projectId}/subcontract/work-orders/${testWo.id}`);
    }
  });

  it('lists seeded work order WO-001', async () => {
    const res = await authGet(token, `/api/projects/${projectId}/subcontract/work-orders`);
    expect(res.status).toBe(200);
    expect((res.body.data as Array<{ woNumber: string }>).some((w) => w.woNumber === 'WO-001')).toBe(true);
  });

  it('returns work order summary with certified totals', async () => {
    const woRes = await authGet(token, `/api/projects/${projectId}/subcontract/work-orders`);
    const wo = (woRes.body.data as Array<{ id: string; woNumber: string }>).find(
      (w) => w.woNumber === 'WO-001',
    );
    expect(wo).toBeTruthy();

    const summaryRes = await authGet(
      token,
      `/api/projects/${projectId}/subcontract/work-orders/${wo!.id}/summary`,
    );
    expect(summaryRes.status).toBe(200);
    const summary = summaryRes.body.data as { contractValue: number; certifiedTotal: number };
    expect(summary.contractValue).toBeGreaterThanOrEqual(2_000_000);
    expect(summary.certifiedTotal).toBeGreaterThanOrEqual(0);
  });

  it('creates measurement, submits, approves with bill retention', async () => {
    const woRes = await authGet(token, `/api/projects/${projectId}/subcontract/work-orders`);
    const wo = (woRes.body.data as Array<{ id: string; woNumber: string }>).find(
      (w) => w.woNumber === 'WO-001',
    );
    expect(wo).toBeTruthy();

    const createRes = await authPost(
      token,
      `/api/projects/${projectId}/subcontract/work-orders/${wo!.id}/measurements`,
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

    const gross = 5000;
    const bill = approveRes.body.data.bill as {
      subtotal: string | number;
      retentionAmount: string | number;
      total: string | number;
    };
    expect(Number(bill.subtotal)).toBe(gross);
    expect(Number(bill.retentionAmount)).toBeGreaterThan(0);
    expect(Number(bill.total)).toBeLessThan(gross);
  });

  it('rejects submitted measurement then allows resubmit after edit', async () => {
    const woRes = await authGet(token, `/api/projects/${projectId}/subcontract/work-orders`);
    const wo = (woRes.body.data as Array<{ id: string; woNumber: string }>).find(
      (w) => w.woNumber === 'WO-001',
    );
    expect(wo).toBeTruthy();

    const createRes = await authPost(
      token,
      `/api/projects/${projectId}/subcontract/work-orders/${wo!.id}/measurements`,
      {
        periodLabel: 'Reject test',
        lines: [{ description: 'Reject me', quantity: 1, unit: 'Nos', rate: 1000 }],
      },
    );
    const measId = createRes.body.data.id as string;
    await authPost(token, `/api/projects/${projectId}/subcontract/measurements/${measId}/submit`);

    const rejectRes = await authPost(
      token,
      `/api/projects/${projectId}/subcontract/measurements/${measId}/reject`,
      { reason: 'Qty mismatch' },
    );
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.data.status).toBe('REJECTED');

    const updateRes = await request(app)
      .put(`/api/projects/${projectId}/subcontract/measurements/${measId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        periodLabel: 'Reject test revised',
        lines: [{ description: 'Reject me fixed', quantity: 1, unit: 'Nos', rate: 1000 }],
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.status).toBe('DRAFT');

    const resubmit = await authPost(
      token,
      `/api/projects/${projectId}/subcontract/measurements/${measId}/submit`,
    );
    expect(resubmit.status).toBe(200);
    expect(resubmit.body.data.status).toBe('SUBMITTED');
  });

  it('creates work order from SUBCONTRACTOR BOQ items on NH-45', async () => {
    const projectsRes = await authGet(token, '/api/projects');
    const trail = (projectsRes.body.data as Array<{ id: string; code: string }>).find(
      (p) => p.code === 'NH45',
    );
    expect(trail).toBeTruthy();

    const boqRes = await authGet(token, `/api/projects/${trail!.id}/boq`);
    const scItem = (boqRes.body.data.items as Array<{ id: string; category: string }>).find(
      (i) => i.category === 'SUBCONTRACTOR',
    );
    if (!scItem) return; // Skip if no SUBCONTRACTOR BOQ item in seed

    const subsRes = await authGet(token, '/api/subcontractors');
    const sub = (subsRes.body.data as Array<{ id: string; name: string }>).find(
      (s) => s.name === 'Sharma Earthworks',
    );
    expect(sub).toBeTruthy();

    const woRes = await authPost(
      token,
      `/api/projects/${trail!.id}/subcontract/work-orders/from-boq`,
      {
        subcontractorId: sub!.id,
        woNumber: 'WO-TEST-BOQ',
        boqItemIds: [scItem!.id],
        retentionPct: 5,
        advanceAmount: 0,
      },
    );
    expect(woRes.status).toBe(201);
    expect(woRes.body.data.woNumber).toBe('WO-TEST-BOQ');
    expect(woRes.body.data.contractLines?.length ?? 0).toBeGreaterThan(0);
  });

  it('blocks completing WO when not fully certified', async () => {
    const subsRes = await authGet(token, '/api/subcontractors');
    const sub = (subsRes.body.data as Array<{ id: string }>)[0];
    expect(sub).toBeTruthy();

    const createWo = await authPost(token, `/api/projects/${projectId}/subcontract/work-orders`, {
      subcontractorId: sub!.id,
      woNumber: `WO-PARTIAL-${Date.now()}`,
      scope: 'Partial certify test',
      contractValue: 10_000,
      retentionPct: 5,
      advanceAmount: 0,
    });
    expect(createWo.status).toBe(201);
    const woId = createWo.body.data.id as string;

    const createMeas = await authPost(
      token,
      `/api/projects/${projectId}/subcontract/work-orders/${woId}/measurements`,
      {
        periodLabel: 'Partial only',
        lines: [{ description: 'Partial work', quantity: 2, unit: 'cum', rate: 500 }],
      },
    );
    const measId = createMeas.body.data.id as string;
    await authPost(token, `/api/projects/${projectId}/subcontract/measurements/${measId}/submit`);
    await authPost(
      token,
      `/api/projects/${projectId}/subcontract/measurements/${measId}/approve`,
      { createBill: false },
    );

    const res = await authPut(token, `/api/projects/${projectId}/subcontract/work-orders/${woId}`, {
      status: 'COMPLETED',
    });
    expect(res.status).toBe(400);
    expect(res.body.error?.message ?? res.body.message).toMatch(/not fully certified/i);
  });

  it('creates retention release bill when WO is fully certified and completed', async () => {
    const subsRes = await authGet(token, '/api/subcontractors');
    const sub = (subsRes.body.data as Array<{ id: string }>)[0];
    expect(sub).toBeTruthy();

    const woNumber = `WO-RET-${Date.now()}`;
    const createWo = await authPost(token, `/api/projects/${projectId}/subcontract/work-orders`, {
      subcontractorId: sub!.id,
      woNumber,
      scope: 'Retention release test',
      contractValue: 1000,
      retentionPct: 5,
      advanceAmount: 0,
    });
    expect(createWo.status).toBe(201);
    const woId = createWo.body.data.id as string;

    const createMeas = await authPost(
      token,
      `/api/projects/${projectId}/subcontract/work-orders/${woId}/measurements`,
      {
        periodLabel: 'Full certify',
        lines: [{ description: 'All work', quantity: 2, unit: 'Nos', rate: 500 }],
      },
    );
    const measId = createMeas.body.data.id as string;
    await authPost(token, `/api/projects/${projectId}/subcontract/measurements/${measId}/submit`);
    const approveMeas = await authPost(
      token,
      `/api/projects/${projectId}/subcontract/measurements/${measId}/approve`,
      { createBill: true },
    );
    expect(approveMeas.status).toBe(200);
    expect(Number(approveMeas.body.data.bill.retentionAmount)).toBeGreaterThan(0);

    const complete = await authPut(token, `/api/projects/${projectId}/subcontract/work-orders/${woId}`, {
      status: 'COMPLETED',
    });
    expect(complete.status).toBe(200);
    expect(complete.body.data.retentionReleaseBill).toBeTruthy();
    expect(complete.body.data.retentionReleaseBill.billNumber).toMatch(/^SC-RET-/);
  });

  it('blocks measurements on non-ACTIVE work order', async () => {
    const subsRes = await authGet(token, '/api/subcontractors');
    const sub = (subsRes.body.data as Array<{ id: string }>)[0];

    const createWo = await authPost(token, `/api/projects/${projectId}/subcontract/work-orders`, {
      subcontractorId: sub!.id,
      woNumber: `WO-DRAFT-${Date.now()}`,
      scope: 'Draft WO',
      contractValue: 500,
      retentionPct: 0,
      advanceAmount: 0,
    });
    expect(createWo.status).toBe(201);
    const woId = createWo.body.data.id as string;

    await authPut(token, `/api/projects/${projectId}/subcontract/work-orders/${woId}`, {
      status: 'DRAFT',
    });

    const measRes = await authPost(
      token,
      `/api/projects/${projectId}/subcontract/work-orders/${woId}/measurements`,
      {
        periodLabel: 'Should fail',
        lines: [{ description: 'Test', quantity: 1, unit: 'Nos', rate: 500 }],
      },
    );
    expect(measRes.status).toBe(400);
  });

  it('issues material with boqItemId and reflects subIssuedQty on BOQ list', async () => {
    const boqRes = await authGet(token, `/api/projects/${projectId}/boq`);
    const carpetBoq = (
      boqRes.body.data.items as Array<{
        id: string;
        category: string;
        resourceId: string | null;
        itemCode: string;
        subIssuedQty?: number;
      }>
    ).find((i) => i.itemCode === 'BOQ-002' && i.category === 'MATERIAL');
    expect(carpetBoq).toBeTruthy();
    expect(carpetBoq!.resourceId).toBeTruthy();

    const subsRes = await authGet(token, '/api/subcontractors');
    const sub = (subsRes.body.data as Array<{ id: string }>)[0];
    expect(sub).toBeTruthy();

    const ts = Date.now();
    const woRes = await authPost(token, `/api/projects/${projectId}/subcontract/work-orders`, {
      subcontractorId: sub!.id,
      woNumber: `WO-BOQ-LINK-${ts}`,
      scope: 'BOQ link material issue test',
      contractValue: 10_000,
      retentionPct: 0,
      advanceAmount: 0,
      materialSupplyMode: 'GC_SUPPLIED',
    });
    expect(woRes.status).toBe(201);
    const woId = woRes.body.data.id as string;

    const issueQty = 5;
    const issueRes = await authPost(
      token,
      `/api/projects/${projectId}/subcontract/work-orders/${woId}/material-issues`,
      {
        resourceId: carpetBoq!.resourceId!,
        quantity: issueQty,
        unit: 'sqm',
        rate: 680,
        issueDate: new Date().toISOString().slice(0, 10),
        boqItemId: carpetBoq!.id,
      },
    );
    if (issueRes.status === 400) {
      const msg = issueRes.body.error?.message ?? issueRes.body.message ?? '';
      expect(String(msg)).toMatch(/stock|Insufficient/i);
      return;
    }
    expect(issueRes.status).toBe(201);
    expect(issueRes.body.data.boqItemId).toBe(carpetBoq!.id);

    const boqAfter = await authGet(token, `/api/projects/${projectId}/boq`);
    const carpetAfter = (
      boqAfter.body.data.items as Array<{ id: string; subIssuedQty?: number }>
    ).find((i) => i.id === carpetBoq!.id);
    expect((carpetAfter?.subIssuedQty ?? 0) - (carpetBoq!.subIssuedQty ?? 0)).toBeGreaterThanOrEqual(
      issueQty,
    );
  });

  it('rejects boqItemId when BOQ line is not MATERIAL category', async () => {
    const boqRes = await authGet(token, `/api/projects/${projectId}/boq`);
    const earthBoq = (
      boqRes.body.data.items as Array<{ id: string; category: string; itemCode: string }>
    ).find((i) => i.itemCode === 'BOQ-001');
    expect(earthBoq).toBeTruthy();

    const resRes = await authGet(token, '/api/resources?type=MATERIAL&search=OPC');
    const resource = (resRes.body.data as Array<{ id: string; unit?: string }>)[0];
    if (!resource) return;

    const subsRes = await authGet(token, '/api/subcontractors');
    const sub = (subsRes.body.data as Array<{ id: string }>)[0];
    expect(sub).toBeTruthy();

    const woRes = await authPost(token, `/api/projects/${projectId}/subcontract/work-orders`, {
      subcontractorId: sub!.id,
      woNumber: `WO-BAD-BOQ-${Date.now()}`,
      scope: 'Invalid BOQ category test',
      contractValue: 5000,
      retentionPct: 0,
      advanceAmount: 0,
      materialSupplyMode: 'GC_SUPPLIED',
    });
    expect(woRes.status).toBe(201);
    const woId = woRes.body.data.id as string;

    const issueRes = await authPost(
      token,
      `/api/projects/${projectId}/subcontract/work-orders/${woId}/material-issues`,
      {
        resourceId: resource.id,
        quantity: 1,
        unit: resource.unit ?? 'bag',
        rate: 400,
        issueDate: new Date().toISOString().slice(0, 10),
        boqItemId: earthBoq!.id,
      },
    );
    expect(issueRes.status).toBe(400);
    const msg = issueRes.body.error?.message ?? issueRes.body.message ?? '';
    expect(String(msg)).toMatch(/MATERIAL/i);
  });
});
