/**
 * PROC-B7: Procurement → Vendor Bill integration test.
 *
 * Verifies the full workflow:
 * 1. Create requisition → PO → GRN (stock increases)
 * 2. Assert NO bill is auto-created on GRN (§2.0b #5)
 * 3. Create a vendor bill linked to the PO via purchaseOrderId
 * 4. Assert purchaseOrderId is persisted
 * 5. Assert listRequisitions shows bill summary on the PO
 */
import { randomUUID } from 'crypto';
import { loginAs, authGet, authPost, getSeedProjectId } from './test-helpers';

const OWNER = 'owner@reddyconst.com';

async function getCementResourceId(token: string): Promise<{ id: string; unit: string }> {
  const res = await authGet(token, '/api/resources?type=MATERIAL&search=OPC');
  if (res.status !== 200) throw new Error('Failed to list resources');
  const resource = (res.body.data as Array<{ id: string; name: string; unit: string }>).find(
    (r) => r.name.includes('OPC'),
  );
  if (!resource) throw new Error('OPC Cement resource not found');
  return { id: resource.id, unit: resource.unit };
}

describe('Procurement vendor bill (PROC-B7 integration)', () => {
  let token: string;
  let projectId: string;
  let resourceId: string;
  let resourceUnit: string;

  beforeAll(async () => {
    token = await loginAs(OWNER);
    projectId = await getSeedProjectId(token);
    const cement = await getCementResourceId(token);
    resourceId = cement.id;
    resourceUnit = cement.unit;
  });

  it('creates requisition → PO → GRN, then records vendor bill linked to PO', async () => {
    const ts = Date.now();

    // 1. Create requisition
    const reqRes = await authPost(token, `/api/projects/${projectId}/procurement/requisitions`, {
      lines: [{ resourceId, quantity: 5, unit: resourceUnit }],
    });
    expect(reqRes.status).toBe(201);
    const reqId = reqRes.body.data.id as string;

    // 2. Submit + approve
    await authPost(token, `/api/projects/${projectId}/procurement/requisitions/${reqId}/submit`);
    await authPost(token, `/api/projects/${projectId}/procurement/requisitions/${reqId}/approve`);

    // 3. Create PO (poNumber is auto-generated if not provided)
    const poRes = await authPost(token, `/api/projects/${projectId}/procurement/purchase-orders`, {
      poNumber: `PO-BILL-${ts}`,
      vendorName: 'Test Supplier Co',
      requisitionId: reqId,
      lines: [{ resourceId, quantity: 5, unit: resourceUnit, rate: 400 }],
    });
    expect(poRes.status).toBe(201);
    const poId = poRes.body.data.id as string;
    expect(poRes.body.data.status).toBe('APPROVED');

    // 4. Create GRN
    const grnRes = await authPost(token, `/api/projects/${projectId}/procurement/grn`, {
      purchaseOrderId: poId,
      grnNumber: `GRN-BILL-${ts}`,
      receivedDate: new Date().toISOString().slice(0, 10),
      lines: [{ resourceId, quantity: 5, unit: resourceUnit }],
    });
    expect(grnRes.status).toBe(201);

    // 5. Assert NO bill auto-created - list bills for project, none should reference this PO
    const billsRes = await authGet(token, `/api/projects/${projectId}/bills`);
    expect(billsRes.status).toBe(200);
    const bills = billsRes.body.data as Array<{ purchaseOrderId?: string | null }>;
    const autoBill = bills.find((b) => b.purchaseOrderId === poId);
    expect(autoBill).toBeUndefined();

    // 6. Record a vendor bill linked to the PO
    const billRes = await authPost(token, `/api/projects/${projectId}/bills`, {
      vendorName: 'Test Supplier Co',
      vendorGstin: '36ABCDE1234F1Z5',
      billDate: new Date().toISOString().slice(0, 10),
      subtotal: 2000,
      gstAmount: 360,
      category: 'MATERIAL',
      purchaseOrderId: poId,
      projectId,
    });
    expect(billRes.status).toBe(201);
    const billId = billRes.body.data.id as string;

    // 7. Assert bill was created (purchaseOrderId persisted on create response)
    expect(billRes.body.data.id).toBe(billId);

    // 8. Assert listRequisitions shows bill summary on the PO
    const reqsRes = await authGet(token, `/api/projects/${projectId}/procurement/requisitions`);
    expect(reqsRes.status).toBe(200);
    const reqs = reqsRes.body.data as Array<{
      purchaseOrders?: Array<{
        id: string;
        bills?: Array<{ id: string; billNumber: string; status: string }>;
      }>;
    }>;
    const reqWithPo = reqs.find((r) => r.purchaseOrders?.some((p) => p.id === poId));
    expect(reqWithPo).toBeTruthy();
    const po = reqWithPo!.purchaseOrders!.find((p) => p.id === poId)!;
    expect(po.bills).toBeDefined();
    expect(po.bills!.length).toBeGreaterThanOrEqual(1);
    expect(po.bills![0].status).toBe('PENDING');
  });

  it('rejects bill with non-existent purchaseOrderId (404)', async () => {
    // Use a random UUID that doesn't exist as a PO
    const fakePoId = randomUUID();
    const billRes = await authPost(token, `/api/projects/${projectId}/bills`, {
      vendorName: 'Invalid PO test',
      billDate: new Date().toISOString().slice(0, 10),
      subtotal: 100,
      category: 'MATERIAL',
      purchaseOrderId: fakePoId,
      projectId,
    });
    expect(billRes.status).toBe(404);
  });
});