/**
 * INVENTORY_PRODUCT (docs/INVENTORY_PRODUCT_IMPL.md) integration tests.
 *
 * Covers:
 *  - Inventory signup → INVENTORY plan + hidden STORE project + defaultProjectId
 *  - Second project blocked (402); default STORE project cannot be deleted
 *  - Invite allow-lists (both directions)
 *  - Module API gates (estimates / subcontract / planning / daily reports → 403)
 *  - Indent → PO → GRN → vendor bill → sales invoice happy path (INVENTORY_MANAGER)
 *  - Tally export for the store project
 *  - Pricing constants (499 / 1999 / 4999, ENTERPRISE contact-sales)
 *  - Assistant tool scoping (estimate tools denied for inventory accounts)
 */
import request from 'supertest';
import { app } from '../../app';
import { prisma } from '../../lib/prisma';
import { authPost, authGet, loginAs } from './test-helpers';
import { PLAN_PRICES_INR, PLAN_ANNUAL_INR, PLAN_LIMITS } from '@buildflow/shared';
import { resolveAssistantIdentity, executeAssistantTool } from '../../services/assistant-tools.service';

const PASSWORD = 'Test@1234';
const CONSTRUCTION_OWNER = 'owner@reddyconst.com';

function uniqueGstin(): string {
  const n = Date.now().toString().slice(-6);
  return `36AABCR${n.slice(0, 4)}A1Z5`;
}

async function registerInventoryCompany(suffix: string) {
  const res = await request(app).post('/api/auth/register').send({
    companyName: `Test Inventory Co ${suffix}`,
    gstin: uniqueGstin(),
    pan: `AABCR${suffix.slice(-4).toUpperCase()}A`,
    state: 'Telangana',
    ownerName: 'Inventory Owner',
    ownerEmail: `inv-owner-${suffix}@example.com`,
    password: PASSWORD,
    product: 'inventory',
  });
  return res;
}

describe('INVENTORY_PRODUCT (integration)', () => {
  let invToken: string;
  let invUserId: string;
  let companyId: string;
  let defaultProjectId: string;
  const suffix = Date.now().toString();

  beforeAll(async () => {
    const res = await registerInventoryCompany(suffix);
    if (res.status !== 201) {
      throw new Error(`Inventory register failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    invToken = res.body.data.accessToken as string;
    invUserId = res.body.data.user.id as string;
    companyId = res.body.data.user.companyId as string;
    defaultProjectId = res.body.data.user.defaultProjectId as string;
  });

  afterAll(async () => {
    if (companyId) {
      // Delete in dependency order to avoid FK violations.
      await prisma.materialPriceHistory.deleteMany({ where: { companyId } });
      // Stock locations cascade stock balances + movements.
      await prisma.stockLocation.deleteMany({ where: { companyId } });
      await prisma.invoice.deleteMany({ where: { companyId } });
      await prisma.bill.deleteMany({ where: { companyId } });
      await prisma.journalEntry.deleteMany({ where: { companyId } });
      await prisma.auditLog.deleteMany({ where: { companyId } });
      await prisma.project.deleteMany({ where: { companyId } });
      await prisma.userInvite.deleteMany({ where: { companyId } });
      await prisma.resource.deleteMany({ where: { companyId } });
      await prisma.user.deleteMany({ where: { companyId } });
      await prisma.company.deleteMany({ where: { id: companyId } });
    }
  });

  /* ── Signup: plan, STORE project, productMode ─────────────────────── */
  it('inventory signup creates INVENTORY plan, STORE project, defaultProjectId + productMode', async () => {
    expect(invToken).toBeTruthy();
    expect(companyId).toBeTruthy();
    expect(defaultProjectId).toBeTruthy();

    const me = await authGet(invToken, '/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.productMode).toBe('inventory');
    expect(me.body.data.subscriptionPlan).toBe('INVENTORY');
    expect(me.body.data.defaultProjectId).toBe(defaultProjectId);
    expect(me.body.data.enabledModules).toEqual(
      expect.arrayContaining(['inventory_shell', 'stock', 'procurement', 'invoices', 'bills', 'tally']),
    );
    expect(me.body.data.enabledModules).not.toContain('estimates');

    const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    expect(company.subscriptionPlan).toBe('INVENTORY');
    expect(company.defaultProjectId).toBe(defaultProjectId);

    const store = await prisma.project.findUniqueOrThrow({ where: { id: defaultProjectId } });
    expect(store.code).toBe('STORE');
    expect(store.companyId).toBe(companyId);
  });

  /* ── Project limits ───────────────────────────────────────────────── */
  it('blocks a second project on the INVENTORY plan (402)', async () => {
    const res = await authPost(invToken, '/api/projects', {
      name: 'Second Project',
      code: 'P2',
      type: 'MINI',
      clientName: 'X',
    });
    expect(res.status).toBe(402);
    expect(res.body.error?.message ?? res.body.message).toMatch(/Inventory plan includes one store/i);
  });

  it('cannot delete the default STORE project (403)', async () => {
    const res = await request(app)
      .delete(`/api/projects/${defaultProjectId}`)
      .set('Authorization', `Bearer ${invToken}`);
    expect(res.status).toBe(403);
  });

  /* ── Invite allow-lists (both directions) ─────────────────────────── */
  it('rejects inviting a PM on an inventory company (400)', async () => {
    const res = await authPost(invToken, '/api/settings/users/invite', {
      email: `pm-${suffix}@example.com`,
      role: 'PM',
    });
    expect(res.status).toBe(400);
  });

  it('accepts inviting INVENTORY_MANAGER on an inventory company (201)', async () => {
    const res = await authPost(invToken, '/api/settings/users/invite', {
      email: `im-${suffix}@example.com`,
      role: 'INVENTORY_MANAGER',
    });
    expect(res.status).toBe(201);
    const inviteRow = await prisma.userInvite.findFirst({
      where: { companyId, email: `im-${suffix}@example.com` },
    });
    expect(inviteRow?.role).toBe('INVENTORY_MANAGER');
  });

  it('rejects inviting INVENTORY_MANAGER on a construction company (400)', async () => {
    const cToken = await loginAs(CONSTRUCTION_OWNER);
    const res = await authPost(cToken, '/api/settings/users/invite', {
      email: `im-construction-${suffix}@example.com`,
      role: 'INVENTORY_MANAGER',
    });
    expect(res.status).toBe(400);
  });

  /* ── Module API gates → 403 for inventory tenants ─────────────────── */
  it('blocks estimate, subcontract, planning (WBS) and daily-report routes for inventory users (403)', async () => {
    const estimates = await authGet(invToken, `/api/projects/${defaultProjectId}/estimates`);
    expect(estimates.status).toBe(403);

    const subcontract = await authGet(
      invToken,
      `/api/projects/${defaultProjectId}/subcontract/work-orders`,
    );
    expect(subcontract.status).toBe(403);

    const wbs = await authGet(invToken, `/api/projects/${defaultProjectId}/wbs`);
    expect(wbs.status).toBe(403);

    const reports = await authGet(invToken, `/api/projects/${defaultProjectId}/reports`);
    expect(reports.status).toBe(403);
  });


  /* ── Full stock + AP/AR happy path as INVENTORY_MANAGER ───────────── */
  it('runs catalog → indent → PO → GRN → issue → bill → sales invoice as INVENTORY_MANAGER', async () => {
    // Invite + accept an INVENTORY_MANAGER.
    const inviteRes = await authPost(invToken, '/api/settings/users/invite', {
      email: `im-flow-${suffix}@example.com`,
      role: 'INVENTORY_MANAGER',
    });
    expect(inviteRes.status).toBe(201);
    const inviteToken = inviteRes.body.data.token as string;

    const acceptRes = await request(app).post('/api/auth/accept-invite').send({
      token: inviteToken,
      name: 'Store Manager',
      password: PASSWORD,
    });
    expect(acceptRes.status).toBe(201);
    const imToken = acceptRes.body.data.accessToken as string;
    expect(acceptRes.body.data.user.productMode).toBe('inventory');

    // INVENTORY_MANAGER can create materials in the catalog.
    const resourceRes = await authPost(imToken, '/api/resources', {
      name: `Cement ${suffix}`,
      type: 'MATERIAL',
      unit: 'bag',
      rate: 350,
      gstRate: 18,
    });
    expect(resourceRes.status).toBe(201);
    const resourceId = resourceRes.body.data.id as string;

    // Indent → submit → approve → PO → GRN
    const reqRes = await authPost(imToken, `/api/projects/${defaultProjectId}/procurement/requisitions`, {
      reqNumber: `IND-${suffix}`,
      lines: [{ resourceId, quantity: 10, unit: 'bag' }],
    });
    expect(reqRes.status).toBe(201);
    const reqId = reqRes.body.data.id as string;
    await authPost(imToken, `/api/projects/${defaultProjectId}/procurement/requisitions/${reqId}/submit`);
    await authPost(imToken, `/api/projects/${defaultProjectId}/procurement/requisitions/${reqId}/approve`);

    const poRes = await authPost(imToken, `/api/projects/${defaultProjectId}/procurement/purchase-orders`, {
      poNumber: `PO-${suffix}`,
      vendorName: 'Steel Supplier',
      requisitionId: reqId,
      lines: [{ resourceId, quantity: 10, unit: 'bag', rate: 340 }],
    });
    expect(poRes.status).toBe(201);
    const poId = poRes.body.data.id as string;

    const grnRes = await authPost(imToken, `/api/projects/${defaultProjectId}/procurement/grn`, {
      grnNumber: `GRN-${suffix}`,
      purchaseOrderId: poId,
      receivedDate: new Date().toISOString().slice(0, 10),
      lines: [{ resourceId, quantity: 10, unit: 'bag' }],
    });
    expect(grnRes.status).toBe(201);
    const grnId = grnRes.body.data.id as string;

    // Inventory auto-draft vendor bill from GRN (qty × PO rate)
    const billsAfterGrn = await authGet(imToken, `/api/projects/${defaultProjectId}/bills`);
    expect(billsAfterGrn.status).toBe(200);
    const draft = (billsAfterGrn.body.data as Array<{
      id: string;
      status: string;
      subtotal: number;
      purchaseOrderId?: string | null;
      goodsReceiptId?: string | null;
    }>).find((b) => b.goodsReceiptId === grnId || b.purchaseOrderId === poId);
    expect(draft).toBeTruthy();
    expect(draft!.status).toBe('DRAFT');
    expect(Number(draft!.subtotal)).toBeCloseTo(3400, 2); // 10 × 340
    expect(draft!.purchaseOrderId).toBe(poId);
    expect(draft!.goodsReceiptId).toBe(grnId);

    const confirmRes = await authPost(imToken, `/api/bills/${draft!.id}/approve`, {});
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.status).toBe('APPROVED');

    // Stock on hand after GRN
    const summaryAfterGrn = await authGet(
      imToken,
      `/api/projects/${defaultProjectId}/procurement/stock/summary`,
    );
    expect(summaryAfterGrn.status).toBe(200);
    const stockRow = (summaryAfterGrn.body.data as Array<{ resourceId: string; balance: number }>).find(
      (r) => r.resourceId === resourceId,
    );
    expect(stockRow).toBeTruthy();
    expect(Number(stockRow!.balance)).toBeCloseTo(10, 3);

    // Issue 3 bags — balance 7 + auto draft sales invoice
    const issueRes = await authPost(imToken, `/api/projects/${defaultProjectId}/procurement/stock/issue`, {
      resourceId,
      quantity: 3,
      unitPrice: 420,
      customerName: 'Retail Buyer',
      notes: 'Sold to walk-in',
    });
    expect(issueRes.status).toBe(201);
    expect(Number(issueRes.body.data.quantityOnHand)).toBeCloseTo(7, 3);
    expect(issueRes.body.data.draftInvoiceId).toBeTruthy();

    const invoicesAfterIssue = await authGet(imToken, `/api/projects/${defaultProjectId}/invoices`);
    expect(invoicesAfterIssue.status).toBe(200);
    const draftInv = (invoicesAfterIssue.body.data as Array<{
      id: string;
      status: string;
      clientName: string;
      subtotal: number;
      stockMovementId?: string | null;
    }>).find((i) => i.id === issueRes.body.data.draftInvoiceId);
    expect(draftInv).toBeTruthy();
    expect(draftInv!.status).toBe('DRAFT');
    expect(draftInv!.clientName).toBe('Retail Buyer');
    expect(Number(draftInv!.subtotal)).toBeCloseTo(3 * 420, 2);
    expect(draftInv!.stockMovementId).toBe(issueRes.body.data.movementId);

    const sendRes = await authPost(imToken, `/api/invoices/${draftInv!.id}/send`, {});
    expect(sendRes.status).toBe(200);
    expect(sendRes.body.data.status).toBe('SENT');

    // Mobile posts /record-payment (same path as bills); /payment is the legacy alias.
    const total = Number(sendRes.body.data.total);
    const payRes = await authPost(imToken, `/api/invoices/${draftInv!.id}/record-payment`, {
      amount: total,
    });
    expect(payRes.status).toBe(200);
    expect(payRes.body.data.status).toBe('PAID');
    expect(Number(payRes.body.data.paidAmount)).toBeCloseTo(total, 2);

    const summaryAfterIssue = await authGet(
      imToken,
      `/api/projects/${defaultProjectId}/procurement/stock/summary`,
    );
    const afterIssue = (summaryAfterIssue.body.data as Array<{ resourceId: string; balance: number }>).find(
      (r) => r.resourceId === resourceId,
    );
    expect(Number(afterIssue!.balance)).toBeCloseTo(7, 3);
  });

  it('creates a separate draft bill per partial GRN on the same PO', async () => {
    const suffix = `PART-${Date.now()}`;
    const resourceRes = await authPost(invToken, '/api/resources', {
      name: `Partial Mat ${suffix}`,
      type: 'MATERIAL',
      unit: 'bag',
      rate: 100,
    });
    expect(resourceRes.status).toBe(201);
    const resourceId = resourceRes.body.data.id as string;

    const reqRes = await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/requisitions`, {
      reqNumber: `IND-${suffix}`,
      lines: [{ resourceId, quantity: 10, unit: 'bag' }],
    });
    const reqId = reqRes.body.data.id as string;
    await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/requisitions/${reqId}/submit`);
    await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/requisitions/${reqId}/approve`);

    const poRes = await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/purchase-orders`, {
      poNumber: `PO-${suffix}`,
      vendorName: 'Partial Vendor',
      requisitionId: reqId,
      lines: [{ resourceId, quantity: 10, unit: 'bag', rate: 100 }],
    });
    const poId = poRes.body.data.id as string;

    const grn1 = await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/grn`, {
      grnNumber: `GRN-${suffix}-1`,
      purchaseOrderId: poId,
      receivedDate: new Date().toISOString().slice(0, 10),
      lines: [{ resourceId, quantity: 4, unit: 'bag' }],
    });
    expect(grn1.status).toBe(201);

    const grn2 = await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/grn`, {
      grnNumber: `GRN-${suffix}-2`,
      purchaseOrderId: poId,
      receivedDate: new Date().toISOString().slice(0, 10),
      lines: [{ resourceId, quantity: 6, unit: 'bag' }],
    });
    expect(grn2.status).toBe(201);

    const billsRes = await authGet(invToken, `/api/projects/${defaultProjectId}/bills`);
    const drafts = (billsRes.body.data as Array<{
      purchaseOrderId?: string | null;
      goodsReceiptId?: string | null;
      status: string;
      subtotal: number;
    }>).filter((b) => b.purchaseOrderId === poId && b.status === 'DRAFT');
    expect(drafts).toHaveLength(2);
    expect(drafts.map((d) => Number(d.subtotal)).sort((a, b) => a - b)).toEqual([400, 600]);
  });


  /* ── Tally export ─────────────────────────────────────────────────── */
  it('exports Tally XML for the store project', async () => {
    const res = await request(app)
      .get(`/api/projects/${defaultProjectId}/financials/export-tally`)
      .set('Authorization', `Bearer ${invToken}`);
    expect(res.status).toBe(200);
    const xml = String(res.text ?? '');
    expect(xml).toMatch(/ENVELOP/);
    expect(xml.toLowerCase()).toContain('sales');
  });

  /* ── Pricing constants (single source of truth) ───────────────────── */
  it('exposes India-friendly prices + inventory limits in shared constants', () => {
    expect(PLAN_PRICES_INR.INVENTORY).toBe(499);
    expect(PLAN_PRICES_INR.STARTER).toBe(1999);
    expect(PLAN_PRICES_INR.PROFESSIONAL).toBe(4999);
    expect(PLAN_PRICES_INR.ENTERPRISE).toBeNull(); // contact sales
    expect(PLAN_ANNUAL_INR.INVENTORY).toBe(4990);
    expect(PLAN_ANNUAL_INR.STARTER).toBe(19990);
    expect(PLAN_ANNUAL_INR.PROFESSIONAL).toBe(49990);
    expect(PLAN_LIMITS.INVENTORY).toEqual({ maxProjects: 1, maxUsers: 10 });
  });

  /* ── Assistant scoping ────────────────────────────────────────────── */
  it('denies construction-only assistant tools for inventory accounts', async () => {
    const identity = await resolveAssistantIdentity(companyId, invUserId);
    expect(identity.productMode).toBe('inventory');
    await expect(
      executeAssistantTool(identity, 'list_estimates', { projectId: defaultProjectId }),
    ).rejects.toThrow(/not allowed/i);
  });
});

