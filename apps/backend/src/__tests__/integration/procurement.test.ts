/**
 * Procurement integration tests - indent → PO → GRN → stock.
 */
import { loginAs, authGet, authPost, getSeedProjectId, getProjectId } from './test-helpers';

const OWNER = 'owner@reddyconst.com';

async function getCementResourceId(token: string): Promise<string> {
  const res = await authGet(token, '/api/resources?type=MATERIAL&search=OPC');
  if (res.status !== 200) throw new Error('Failed to list resources');
  const resource = (res.body.data as Array<{ id: string; name: string }>).find((r) =>
    r.name.includes('OPC'),
  );
  if (!resource) throw new Error('OPC Cement resource not found');
  return resource.id;
}

describe('Procurement (integration)', () => {
  let token: string;
  let projectId: string;

  beforeAll(async () => {
    token = await loginAs(OWNER);
    projectId = await getSeedProjectId(token);
  });

  it('lists seeded requisition IND-001', async () => {
    const res = await authGet(token, `/api/projects/${projectId}/procurement/requisitions`);
    expect(res.status).toBe(200);
    expect((res.body.data as Array<{ reqNumber: string }>).some((r) => r.reqNumber === 'IND-001')).toBe(true);
  });

  it('auto-indent IND-AUTO-EST-001 has expected rate snapshot', async () => {
    const res = await authGet(token, `/api/projects/${projectId}/procurement/requisitions`);
    expect(res.status).toBe(200);
    const auto = (res.body.data as Array<{ reqNumber: string; lines: Array<{ expectedRate: number; rateSource: string; boqItem?: { itemCode: string } | null }> }>).find(
      (r) => r.reqNumber === 'IND-AUTO-EST-001',
    );
    expect(auto).toBeTruthy();
    expect(Number(auto!.lines[0]?.expectedRate)).toBe(435);
    expect(auto!.lines[0]?.rateSource).toBe('PROJECT');
    expect(auto!.lines[0]?.boqItem?.itemCode).toBe('BOQ-002');
  });

  it('returns BOQ shortfall preview', async () => {
    const res = await authGet(token, `/api/projects/${projectId}/procurement/boq-shortfalls`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('generate-from-boq creates indents when shortfalls exist', async () => {
    const projectsRes = await authGet(token, '/api/projects');
    const gvr = (projectsRes.body.data as Array<{ id: string; code: string }>).find(
      (p) => p.code === 'GVR-C',
    );
    expect(gvr).toBeTruthy();

    let boqRes = await authGet(token, `/api/projects/${gvr!.id}/boq`);
    expect(boqRes.status).toBe(200);
    let materialItems = (boqRes.body.data?.items ?? []).filter(
      (i: { category: string | null; resourceId?: string | null }) =>
        i.category === 'MATERIAL' && i.resourceId,
    );

    if (materialItems.length === 0) {
      const estimatesRes = await authGet(token, `/api/projects/${gvr!.id}/estimates`);
      expect(estimatesRes.status).toBe(200);
      const estimate = (estimatesRes.body.data as Array<{ id: string; status: string }>).find(
        (e) => e.status === 'APPROVED',
      );
      expect(estimate).toBeTruthy();

      const convertRes = await authPost(token, `/api/estimates/${estimate!.id}/convert-to-boq`);
      expect(convertRes.status).toBe(200);

      boqRes = await authGet(token, `/api/projects/${gvr!.id}/boq`);
      materialItems = (boqRes.body.data?.items ?? []).filter(
        (i: { category: string | null; resourceId?: string | null }) =>
          i.category === 'MATERIAL' && i.resourceId,
      );
    }
    expect(materialItems.length).toBeGreaterThan(0);

    const shortfallsRes = await authGet(token, `/api/projects/${gvr!.id}/procurement/boq-shortfalls`);
    expect(shortfallsRes.status).toBe(200);
    const shortfalls = shortfallsRes.body.data as Array<{ shortfall: number }>;

    const genRes = await authPost(token, `/api/projects/${gvr!.id}/procurement/generate-from-boq`);
    expect(genRes.status).toBe(201);
    const result = genRes.body.data as { created: number; reqNumbers: string[] };
    expect(typeof result.created).toBe('number');
    expect(Array.isArray(result.reqNumbers)).toBe(true);

    if (shortfalls.length > 0) {
      expect(result.created).toBeGreaterThanOrEqual(1);
      const reqsRes = await authGet(token, `/api/projects/${gvr!.id}/procurement/requisitions`);
      const generated = (reqsRes.body.data as Array<{ reqNumber: string; sourceType: string; lines: Array<{ boqItem?: { itemCode: string } | null }> }>).find(
        (r) => r.reqNumber === result.reqNumbers[0],
      );
      expect(generated?.sourceType).toBe('BOQ_UPDATE');
      expect(generated?.lines[0]?.boqItem?.itemCode).toBeTruthy();
    } else {
      expect(result.created).toBe(0);
    }
  });

  it('shows stock balance after GRN', async () => {
    const res = await authGet(token, `/api/projects/${projectId}/procurement/stock`);
    expect(res.status).toBe(200);
    const locations = res.body.data as Array<{
      balances: Array<{ quantity: string; resource: { name: string } }>;
    }>;
    const balances = locations.flatMap((l) => l.balances);
    const cement = balances.find((b) => b.resource?.name?.includes('Cement'));
    expect(cement).toBeTruthy();
    expect(Number(cement!.quantity)).toBeGreaterThanOrEqual(500);
  });

  it('creates requisition with resolved expected rate', async () => {
    const cementId = await getCementResourceId(token);

    const reqNum = `IND-RATE-${Date.now()}`;
    const reqRes = await authPost(token, `/api/projects/${projectId}/procurement/requisitions`, {
      reqNumber: reqNum,
      lines: [{ resourceId: cementId, quantity: 5, unit: 'bag' }],
    });
    expect(reqRes.status).toBe(201);
    const line = reqRes.body.data.lines[0] as { expectedRate: number | string; rateSource: string };
    expect(Number(line.expectedRate)).toBe(435);
    expect(line.rateSource).toBe('PROJECT');
  });

  it('creates multi-line requisition with multiple materials', async () => {
    const resourcesRes = await authGet(token, '/api/resources?type=MATERIAL');
    expect(resourcesRes.status).toBe(200);
    const resources = resourcesRes.body.data as Array<{ id: string; unit: string }>;
    expect(resources.length).toBeGreaterThanOrEqual(2);

    const reqNum = `IND-MULTI-${Date.now()}`;
    const reqRes = await authPost(token, `/api/projects/${projectId}/procurement/requisitions`, {
      reqNumber: reqNum,
      lines: [
        { resourceId: resources[0].id, quantity: 10, unit: resources[0].unit },
        { resourceId: resources[1].id, quantity: 5, unit: resources[1].unit },
      ],
    });
    expect(reqRes.status).toBe(201);
    const lines = reqRes.body.data.lines as Array<{ resourceId: string; quantity: string }>;
    expect(lines).toHaveLength(2);
    expect(Number(lines[0].quantity)).toBe(10);
    expect(Number(lines[1].quantity)).toBe(5);
  });

  it('creates PO after approved requisition', async () => {
    const cementId = await getCementResourceId(token);
    const reqNum = `IND-PO-${Date.now()}`;
    const reqRes = await authPost(token, `/api/projects/${projectId}/procurement/requisitions`, {
      reqNumber: reqNum,
      lines: [{ resourceId: cementId, quantity: 8, unit: 'bag' }],
    });
    expect(reqRes.status).toBe(201);
    const reqId = reqRes.body.data.id as string;

    await authPost(token, `/api/projects/${projectId}/procurement/requisitions/${reqId}/submit`);
    await authPost(token, `/api/projects/${projectId}/procurement/requisitions/${reqId}/approve`);

    const start = Date.now();
    const poRes = await authPost(token, `/api/projects/${projectId}/procurement/purchase-orders`, {
      poNumber: `PO-APPROVED-${Date.now()}`,
      vendorName: 'Test Vendor',
      requisitionId: reqId,
      lines: [{ resourceId: cementId, quantity: 8, unit: 'bag', rate: 435 }],
    });
    expect(poRes.status).toBe(201);
    expect(Date.now() - start).toBeLessThan(10_000);
    expect(poRes.body.data.poNumber).toBeTruthy();
  });

  it('returns 409 quickly when PO number is duplicate', async () => {
    const start = Date.now();
    const dupRes = await authPost(token, `/api/projects/${projectId}/procurement/purchase-orders`, {
      poNumber: 'PO-001',
      vendorName: 'Duplicate Vendor',
      lines: [{ resourceId: await getCementResourceId(token), quantity: 1, unit: 'bag', rate: 100 }],
    });
    expect(dupRes.status).toBe(409);
    expect(dupRes.body.error?.message).toMatch(/PO number/i);
    expect(Date.now() - start).toBeLessThan(5_000);
  });

  it('creates requisition → PO → GRN and increases stock', async () => {
    const resourcesRes = await authGet(token, '/api/resources?type=MATERIAL');
    expect(resourcesRes.status).toBe(200);
    const resource = resourcesRes.body.data?.[0];
    expect(resource).toBeTruthy();

    const stockBefore = await authGet(token, `/api/projects/${projectId}/procurement/stock`);
    const flatBefore = (stockBefore.body.data as Array<{ balances: Array<{ resourceId: string; quantity: string }> }>).flatMap(
      (l) => l.balances,
    );
    const beforeQty =
      flatBefore.find((b) => b.resourceId === resource.id)?.quantity ?? '0';

    const reqNum = `IND-TEST-${Date.now()}`;
    const reqRes = await authPost(token, `/api/projects/${projectId}/procurement/requisitions`, {
      reqNumber: reqNum,
      lines: [{ resourceId: resource.id, quantity: 10, unit: resource.unit }],
    });
    expect(reqRes.status).toBe(201);
    const reqId = reqRes.body.data.id as string;

    await authPost(token, `/api/projects/${projectId}/procurement/requisitions/${reqId}/submit`);
    await authPost(token, `/api/projects/${projectId}/procurement/requisitions/${reqId}/approve`);

    const poRes = await authPost(token, `/api/projects/${projectId}/procurement/purchase-orders`, {
      poNumber: `PO-TEST-${Date.now()}`,
      vendorName: 'Test Vendor',
      requisitionId: reqId,
      lines: [{ resourceId: resource.id, quantity: 10, unit: resource.unit, rate: 100 }],
    });
    expect(poRes.status).toBe(201);
    const poId = poRes.body.data.id as string;

    const grnRes = await authPost(token, `/api/projects/${projectId}/procurement/grn`, {
      purchaseOrderId: poId,
      grnNumber: `GRN-TEST-${Date.now()}`,
      receivedDate: '2025-04-01',
      lines: [{ resourceId: resource.id, quantity: 10, unit: resource.unit }],
    });
    expect(grnRes.status).toBe(201);

    const stockAfter = await authGet(token, `/api/projects/${projectId}/procurement/stock`);
    const flatAfter = (stockAfter.body.data as Array<{ balances: Array<{ resourceId: string; quantity: string }> }>).flatMap(
      (l) => l.balances,
    );
    const afterQty =
      flatAfter.find((b) => b.resourceId === resource.id)?.quantity ?? '0';
    expect(Number(afterQty)).toBeGreaterThanOrEqual(Number(beforeQty) + 10);
  });

  it('stock summary shows received, issued, and balance after GRN', async () => {
    const resourcesRes = await authGet(token, '/api/resources?type=MATERIAL');
    const resource = resourcesRes.body.data?.[0];
    expect(resource).toBeTruthy();

    const grnQty = 15;
    const reqNum = `IND-SUM-${Date.now()}`;
    const reqRes = await authPost(token, `/api/projects/${projectId}/procurement/requisitions`, {
      reqNumber: reqNum,
      lines: [{ resourceId: resource.id, quantity: grnQty, unit: resource.unit }],
    });
    const reqId = reqRes.body.data.id as string;
    await authPost(token, `/api/projects/${projectId}/procurement/requisitions/${reqId}/submit`);
    await authPost(token, `/api/projects/${projectId}/procurement/requisitions/${reqId}/approve`);

    const poRes = await authPost(token, `/api/projects/${projectId}/procurement/purchase-orders`, {
      poNumber: `PO-SUM-${Date.now()}`,
      vendorName: 'Summary Vendor',
      requisitionId: reqId,
      lines: [{ resourceId: resource.id, quantity: grnQty, unit: resource.unit, rate: 100 }],
    });
    const poId = poRes.body.data.id as string;
    const grnNumber = `GRN-SUM-${Date.now()}`;

    await authPost(token, `/api/projects/${projectId}/procurement/grn`, {
      purchaseOrderId: poId,
      grnNumber,
      receivedDate: '2025-04-02',
      lines: [{ resourceId: resource.id, quantity: grnQty, unit: resource.unit }],
    });

    const summaryRes = await authGet(token, `/api/projects/${projectId}/procurement/stock/summary`);
    expect(summaryRes.status).toBe(200);
    const row = (summaryRes.body.data as Array<{ resourceId: string; received: number; issued: number; balance: number }>).find(
      (r) => r.resourceId === resource.id,
    );
    expect(row).toBeTruthy();
    expect(row!.received).toBeGreaterThanOrEqual(grnQty);
    expect(row!.balance).toBeGreaterThanOrEqual(grnQty);

    const movRes = await authGet(
      token,
      `/api/projects/${projectId}/procurement/stock/movements?resourceId=${resource.id}`,
    );
    expect(movRes.status).toBe(200);
    const inMov = (movRes.body.data as Array<{ type: string; referenceLabel: string | null }>).find(
      (m) => m.type === 'IN' && m.referenceLabel === grnNumber,
    );
    expect(inMov).toBeTruthy();
  });

  it('stock summary issued increases after daily report with deductStock', async () => {
    const cementId = await getCementResourceId(token);

    const summaryBefore = await authGet(token, `/api/projects/${projectId}/procurement/stock/summary`);
    const beforeRow = (summaryBefore.body.data as Array<{ resourceId: string; issued: number; balance: number }>).find(
      (r) => r.resourceId === cementId,
    );
    const issuedBefore = beforeRow?.issued ?? 0;
    const balanceBefore = beforeRow?.balance ?? 0;

    const issueQty = 3;
    const reportRes = await authPost(token, `/api/projects/${projectId}/reports`, {
      reportDate: '2025-04-15',
      workDone: 'Used cement on site',
      deductStock: true,
      materialUsages: [{ resourceId: cementId, quantityUsed: issueQty }],
    });
    expect(reportRes.status).toBe(201);

    const summaryAfter = await authGet(token, `/api/projects/${projectId}/procurement/stock/summary`);
    const afterRow = (summaryAfter.body.data as Array<{ resourceId: string; issued: number; balance: number }>).find(
      (r) => r.resourceId === cementId,
    );
    expect(afterRow).toBeTruthy();
    expect(afterRow!.issued).toBeGreaterThanOrEqual(issuedBefore + issueQty);
    expect(afterRow!.balance).toBeLessThanOrEqual(balanceBefore - issueQty + 0.001);

    const movRes = await authGet(
      token,
      `/api/projects/${projectId}/procurement/stock/movements?resourceId=${cementId}`,
    );
    expect(movRes.status).toBe(200);
    const outMov = (movRes.body.data as Array<{ type: string; referenceType: string; referenceLabel: string | null }>).find(
      (m) => m.type === 'OUT' && m.referenceType === 'DAILY_REPORT',
    );
    expect(outMov).toBeTruthy();
    expect(outMov!.referenceLabel).toMatch(/Daily report/);
  });

  it('material procurement on Trail does not auto-certify subcontract WO', async () => {
    const trailId = await getProjectId(token, 'TRAIL');

    const woRes = await authGet(token, `/api/projects/${trailId}/subcontract/work-orders`);
    const wo = (woRes.body.data as Array<{ id: string; woNumber: string }>).find(
      (w) => w.woNumber === 'WO-TRAIL-001',
    );
    expect(wo).toBeTruthy();

    const summaryRes = await authGet(
      token,
      `/api/projects/${trailId}/subcontract/work-orders/${wo!.id}/summary`,
    );
    expect(summaryRes.status).toBe(200);
    const certifiedTotal = Number(summaryRes.body.data.certifiedTotal);

    const boqRes = await authGet(token, `/api/projects/${trailId}/boq`);
    const carpet = (boqRes.body.data.items as Array<{ itemCode: string; procuredQty: number; category: string }>).find(
      (i) => i.itemCode === 'O-020' && i.category === 'MATERIAL',
    );
    expect(carpet).toBeTruthy();
    expect(Number(carpet!.procuredQty)).toBeGreaterThan(0);

    // Procured material qty is independent of subcontract certification totals
    expect(certifiedTotal).toBeGreaterThan(0);
    expect(certifiedTotal).not.toBe(Number(carpet!.procuredQty));
  });
});
