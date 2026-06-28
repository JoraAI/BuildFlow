/**
 * Procurement integration tests — indent → PO → GRN → stock.
 */
import { loginAs, authGet, authPost, getSeedProjectId } from './test-helpers';

const OWNER = 'owner@reddyconst.com';

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
});
