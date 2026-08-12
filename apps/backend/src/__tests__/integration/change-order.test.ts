/**
 * Change order integration tests - approve (budget) + convert-to-boq (sanctioned qty).
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
    expect(approveRes.body.data.boqAppliedAt).toBeFalsy();

    // VAR-D2d: Approve alone must not change BOQ qty
    const boqAfterApprove = await authGet(token, `/api/projects/${projectId}/boq`);
    const itemAfterApprove = (boqAfterApprove.body.data?.items as Array<{ id: string; quantity: number }>).find(
      (i) => i.id === boqItem.id,
    );
    expect(Number(itemAfterApprove!.quantity)).toBe(Number(boqItem.quantity));

    const convertRes = await authPost(token, `/api/projects/${projectId}/change-orders/${coId}/convert-to-boq`);
    expect(convertRes.status).toBe(200);
    expect(convertRes.body.data.boqAppliedAt).toBeTruthy();

    const boqAfterConvert = await authGet(token, `/api/projects/${projectId}/boq`);
    const itemAfterConvert = (boqAfterConvert.body.data?.items as Array<{ id: string; quantity: number }>).find(
      (i) => i.id === boqItem.id,
    );
    expect(Number(itemAfterConvert!.quantity)).toBe(Number(boqItem.quantity) + 10);

    const doubleConvert = await authPost(token, `/api/projects/${projectId}/change-orders/${coId}/convert-to-boq`);
    expect(doubleConvert.status).toBe(409);
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
    // VAR-D2: Convert to BOQ after approve
    await authPost(token, `/api/projects/${projectId}/change-orders/${coId}/convert-to-boq`);

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

  // VAR-C6: Variation with RA-linked new-scope line → approve → BOQ has RA link.
  it('creates new-scope BOQ row with rateAnalysisId on approve', async () => {
    // Find a rate analysis to link
    const raRes = await authGet(token, '/api/rate-analysis');
    expect(raRes.status).toBe(200);
    const ras = raRes.body.data as Array<{ id: string; name: string; totalRate: string }>;
    expect(ras.length).toBeGreaterThan(0);
    const ra = ras[0];

    const createRes = await authPost(token, `/api/projects/${projectId}/change-orders`, {
      number: `VO-RA-${Date.now()}`,
      title: 'RA-linked new scope',
      reason: 'Integration test',
      scheduleImpactDays: 0,
      lines: [
        {
          description: 'New scope from RA',
          unit: 'Nos',
          qtyDelta: 3,
          rate: Number(ra.totalRate),
          rateAnalysisId: ra.id,
        },
      ],
    });
    expect(createRes.status).toBe(201);
    const coId = createRes.body.data.id as string;

    // Verify rateAnalysisId persisted on the line
    expect(createRes.body.data.lines[0].rateAnalysisId).toBe(ra.id);

    await authPost(token, `/api/projects/${projectId}/change-orders/${coId}/submit`);
    const approveRes = await authPost(token, `/api/projects/${projectId}/change-orders/${coId}/approve`);
    expect(approveRes.status).toBe(200);
    // VAR-D2: Convert to BOQ after approve
    await authPost(token, `/api/projects/${projectId}/change-orders/${coId}/convert-to-boq`);

    // Verify BOQ row has rateAnalysisId set
    const boqRes = await authGet(token, `/api/projects/${projectId}/boq`);
    const newBoqRow = (boqRes.body.data.items as Array<{ itemCode: string; rateAnalysisId?: string; resourceId?: string }>)
      .find((b) => b.itemCode === `VO-${createRes.body.data.number}`);
    expect(newBoqRow).toBeTruthy();
    expect(newBoqRow!.rateAnalysisId).toBe(ra.id);
  });

  // EST-VO-11a: Variation create links estimateId to approved parent estimate.
  it('createChangeOrder sets estimateId to latest approved parent estimate', async () => {
    // Get the approved estimate - the list API only returns top-level estimates
    const estRes = await authGet(token, `/api/projects/${projectId}/estimates`);
    expect(estRes.status).toBe(200);
    const allEstimates = estRes.body.data as Array<{ id: string; status: string }>;
    const approvedParent = allEstimates.find((e) => e.status === 'APPROVED');
    // Skip if no approved estimate in seed
    if (!approvedParent) return;

    const createRes = await authPost(token, `/api/projects/${projectId}/change-orders`, {
      number: `VO-EST-${Date.now()}`,
      title: 'estimateId link test',
      reason: 'Integration test',
      scheduleImpactDays: 0,
      lines: [{ description: 'Test line', unit: 'Nos', qtyDelta: 1, rate: 100 }],
    });
    expect(createRes.status).toBe(201);
    // EST-VO-11a: estimateId should be set to the approved estimate
    expect(createRes.body.data.estimateId).toBe(approvedParent.id);

    // EST-VO-11b: List variations by estimate
    const variationsRes = await authGet(token, `/api/estimates/${approvedParent.id}/variations`);
    expect(variationsRes.status).toBe(200);
    const variations = variationsRes.body.data as Array<{ id: string }>;
    expect(variations.some((v) => v.id === createRes.body.data.id)).toBe(true);
  });

  // VAR-C6b: RA-linked variation → approve → shortfalls show exploded materials.
  it('shortfalls RA-explode variation BOQ rows with direct rateAnalysisId', async () => {
    // Find a rate analysis with MATERIAL components
    const raRes = await authGet(token, '/api/rate-analysis');
    expect(raRes.status).toBe(200);
    const ras = raRes.body.data as Array<{ id: string; name: string; totalRate: string }>;
    // Find one with components
    let raWithComponents: { id: string; totalRate: string } | null = null;
    for (const ra of ras) {
      const detailRes = await authGet(token, `/api/rate-analysis/${ra.id}`);
      const components = detailRes.body.data?.components as Array<{ type: string; resourceId?: string }>;
      if (components?.some((c) => c.type === 'MATERIAL' && c.resourceId)) {
        raWithComponents = ra;
        break;
      }
    }
    if (!raWithComponents) return; // Skip if no RA with MATERIAL components in seed

    const createRes = await authPost(token, `/api/projects/${projectId}/change-orders`, {
      number: `VO-SF-${Date.now()}`,
      title: 'Shortfall RA test',
      reason: 'Integration test',
      scheduleImpactDays: 0,
      lines: [
        {
          description: 'New scope with RA',
          unit: 'Nos',
          qtyDelta: 5,
          rate: Number(raWithComponents.totalRate),
          rateAnalysisId: raWithComponents.id,
        },
      ],
    });
    expect(createRes.status).toBe(201);
    const coId = createRes.body.data.id as string;

    await authPost(token, `/api/projects/${projectId}/change-orders/${coId}/submit`);
    await authPost(token, `/api/projects/${projectId}/change-orders/${coId}/approve`);
    // VAR-D2: Convert to BOQ after approve - shortfalls need BOQ rows to exist
    await authPost(token, `/api/projects/${projectId}/change-orders/${coId}/convert-to-boq`);

    // Shortfalls should include demands from the RA-exploded BOQ row
    const sfRes = await authGet(token, `/api/projects/${projectId}/procurement/boq-shortfalls`);
    expect(sfRes.status).toBe(200);
    const shortfalls = sfRes.body.data as Array<{ itemCode: string }>;
    // The VO row should appear in shortfall demands (may or may not have a
    // shortfall depending on stock, but the demand should be computed)
    const voShortfalls = shortfalls.filter((s) => s.itemCode.startsWith('VO-'));
    expect(voShortfalls.length).toBeGreaterThan(0);
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
