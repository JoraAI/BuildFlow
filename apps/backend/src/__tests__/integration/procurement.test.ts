/**
 * Procurement integration tests - indent → PO → GRN → stock.
 */
import { loginAs, authGet, authPost, getSeedProjectId } from './test-helpers';

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
    const auto = (res.body.data as Array<{ reqNumber: string; lines: Array<{ expectedRate: number; rateSource: string }> }>).find(
      (r) => r.reqNumber === 'IND-AUTO-EST-001',
    );
    expect(auto).toBeTruthy();
    expect(Number(auto!.lines[0]?.expectedRate)).toBe(435);
    expect(auto!.lines[0]?.rateSource).toBe('PROJECT');
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
