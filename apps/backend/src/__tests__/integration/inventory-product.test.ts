/**
 * INVENTORY_PRODUCT (docs/INVENTORY_PRODUCT_IMPL.md) integration tests.
 *
 * Covers:
 *  - Inventory signup → INVENTORY plan + hidden STORE project + defaultProjectId
 *  - Second project blocked (402); default STORE project cannot be deleted
 *  - Invite allow-lists (both directions)
 *  - Module API gates (estimates / subcontract / planning / daily reports → 403)
 *  - Indent → PO → GRN → vendor bill → sales invoice happy path (INVENTORY_MANAGER)
 *  - INVENTORY_UX_POLISH D9: multi-material indent → PO → GRN → multi-line issue
 *    → one draft sales invoice with N line items; over-issue rollback; legacy body
 *  - Tally export for the store project
 *  - Pricing constants (499 / 1999 / 4999, ENTERPRISE contact-sales)
 *  - Assistant tool scoping (estimate tools denied for inventory accounts)
 */
import request from 'supertest';
import { app } from '../../app';
import { prisma } from '../../lib/prisma';
import { authPost, authGet, authPut, loginAs } from './test-helpers';
import { istToday } from '../../services/inventory-analytics.service';
import { PLAN_PRICES_INR, PLAN_ANNUAL_INR, PLAN_LIMITS } from '@buildflow/shared';
import { resolveAssistantIdentity, executeAssistantTool } from '../../services/assistant-tools.service';
import { notifyLowStock } from '../../services/inventory-alerts.service';

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
      // INVENTORY_HORIZONTAL_PLATFORM (Phase 3): warehouse ops reference
      // stock_locations (RESTRICT) - remove transfers + counts first.
      await prisma.transferOrder.deleteMany({ where: { companyId } });
      await prisma.stockCount.deleteMany({ where: { companyId } });
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
    // INVENTORY_HORIZONTAL_PLATFORM (Phase 0): inventory tenants surface their
    // business profile (DB default GENERAL) in the auth payload.
    expect(me.body.data.inventoryProfile).toBe('GENERAL');
    expect(me.body.data.enabledModules).toEqual(
      expect.arrayContaining(['inventory_shell', 'stock', 'procurement', 'invoices', 'bills', 'tally']),
    );
    expect(me.body.data.enabledModules).not.toContain('estimates');

    const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    expect(company.subscriptionPlan).toBe('INVENTORY');
    expect(company.defaultProjectId).toBe(defaultProjectId);
    expect(company.inventoryProfile).toBe('GENERAL');

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

    // INVENTORY_UX_POLISH (D2): inventory indent auto-reaches APPROVED on create
    // (no Submit/Approve steps) - PO is creatable immediately.
    const reqRes = await authPost(imToken, `/api/projects/${defaultProjectId}/procurement/requisitions`, {
      reqNumber: `IND-${suffix}`,
      lines: [{ resourceId, quantity: 10, unit: 'bag' }],
    });
    expect(reqRes.status).toBe(201);
    expect(reqRes.body.data.status).toBe('APPROVED');
    const reqId = reqRes.body.data.id as string;

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

    // Issue 3 bags - balance 7 + auto draft sales invoice
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

    const salesAfterIssue = await authGet(imToken, '/api/inventory/transactions/sales-orders');
    expect(salesAfterIssue.status).toBe(200);
    const counterSale = (salesAfterIssue.body.data as Array<{
      customerName: string;
      status: string;
      notes?: string | null;
    }>).find((so) => so.notes?.includes('AUTO_STOCK_ISSUE') && so.customerName === 'Retail Buyer');
    expect(counterSale).toBeTruthy();
    expect(counterSale!.status).toBe('INVOICED');

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
    expect(reqRes.status).toBe(201);
    expect(reqRes.body.data.status).toBe('APPROVED'); // inventory auto-approve
    const reqId = reqRes.body.data.id as string;

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

  /* ── INVENTORY_HORIZONTAL_PLATFORM (Phase 0): inventoryProfile ────── */
  it('OWNER updates the inventory business profile (Phase 0)', async () => {
    const putRes = await request(app)
      .put('/api/settings/company')
      .set('Authorization', `Bearer ${invToken}`)
      .send({ inventoryProfile: 'WHOLESALE' });
    expect(putRes.status).toBe(200);
    expect(putRes.body.data.inventoryProfile).toBe('WHOLESALE');

    const getRes = await authGet(invToken, '/api/settings/company');
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.inventoryProfile).toBe('WHOLESALE');
  });

  /* ── INVENTORY_HORIZONTAL_PLATFORM Phase 1.1: party master ────────── */
  it('CRUDs customers + vendors (party master)', async () => {
    const cust = await authPost(invToken, '/api/inventory/parties/customers', {
      name: 'Acme Traders',
      phone: '9988776655',
      email: 'buy@acme.in',
      gstin: uniqueGstin(),
      creditLimit: 50000,
    });
    expect(cust.status).toBe(201);
    const custId = cust.body.data.id as string;

    const list = await authGet(invToken, '/api/inventory/parties/customers');
    expect(list.status).toBe(200);
    expect((list.body.data as Array<{ id: string }>).some((c) => c.id === custId)).toBe(true);

    const upd = await request(app)
      .put(`/api/inventory/parties/customers/${custId}`)
      .set('Authorization', `Bearer ${invToken}`)
      .send({ paymentTerms: 'Net 30' });
    expect(upd.status).toBe(200);
    expect(upd.body.data.paymentTerms).toBe('Net 30');

    const del = await request(app)
      .delete(`/api/inventory/parties/customers/${custId}`)
      .set('Authorization', `Bearer ${invToken}`);
    expect(del.status).toBe(200);
    expect(del.body.data.isActive).toBe(false); // soft delete keeps history

    const vendor = await authPost(invToken, '/api/inventory/parties/vendors', {
      name: 'Acme Supplies',
      phone: '9988776600',
    });
    expect(vendor.status).toBe(201);
    const vendors = await authGet(invToken, '/api/inventory/parties/vendors');
    expect(vendors.status).toBe(200);
    expect((vendors.body.data as Array<{ id: string }>).some((v) => v.id === vendor.body.data.id)).toBe(true);
  });

  /* ── Phase 1.2/1.3/1.4: item master + opening stock + adjustments ── */
  it('item master fields persist; opening stock import + adjustments work', async () => {
    const res = await authPost(invToken, '/api/resources', {
      name: `P1 Item ${Date.now()}`,
      type: 'MATERIAL',
      unit: 'bag',
      rate: 200,
      sku: `SKU-${Date.now().toString().slice(-6)}`,
      barcode: '890123456789',
      secondaryUnit: 'kg',
      conversionFactor: 50,
      reorderPoint: 10,
    });
    expect(res.status).toBe(201);
    const id = res.body.data.id as string;

    const dbRow = await prisma.resource.findUniqueOrThrow({ where: { id } });
    expect(dbRow.sku).toBeTruthy();
    expect(dbRow.barcode).toBe('890123456789');
    expect(dbRow.secondaryUnit).toBe('kg');
    expect(Number(dbRow.conversionFactor)).toBe(50);
    expect(Number(dbRow.reorderPoint)).toBe(10);

    // Opening stock import (by name) sets the balance + rate.
    const imp = await authPost(invToken, '/api/inventory/stock/opening-stock', {
      lines: [{ name: dbRow.name, quantity: 100, rate: 210 }],
    });
    expect(imp.status).toBe(201);
    expect(imp.body.data.applied).toBe(1);

    const summary = await authGet(invToken, `/api/projects/${defaultProjectId}/procurement/stock/summary`);
    const row = (summary.body.data as Array<{ resourceId: string; balance: number; reorderPoint: number }>).find(
      (r) => r.resourceId === id,
    );
    expect(row).toBeTruthy();
    expect(Number(row!.balance)).toBeCloseTo(100, 3);
    expect(Number(row!.reorderPoint)).toBe(10);

    // Adjust +5 then −3 → 102 on hand.
    const adj1 = await authPost(invToken, '/api/inventory/stock/adjust', {
      resourceId: id,
      delta: 5,
      reason: 'FOUND_STOCK',
      notes: 'found in back room',
    });
    expect(adj1.status).toBe(201);
    expect(Number(adj1.body.data.quantityOnHand)).toBeCloseTo(105, 3);

    const adj2 = await authPost(invToken, '/api/inventory/stock/adjust', {
      resourceId: id,
      delta: -3,
      reason: 'DAMAGE',
      notes: 'torn bags',
    });
    expect(adj2.status).toBe(201);
    expect(Number(adj2.body.data.quantityOnHand)).toBeCloseTo(102, 3);

    // Movement audit rows carry reason + referenceType.
    const movements = await authGet(
      invToken,
      `/api/projects/${defaultProjectId}/procurement/stock/movements?resourceId=${id}`,
    );
    const adjMoves = (movements.body.data as Array<{ type: string; reason: string; referenceType: string }>).filter(
      (m) => m.type === 'ADJUST',
    );
    expect(adjMoves.length).toBeGreaterThanOrEqual(3); // opening + 2 adjusts
    expect(adjMoves.some((m) => m.reason === 'DAMAGE')).toBe(true);
    expect(adjMoves.some((m) => m.referenceType === 'OPENING_STOCK')).toBe(true);

    // Adjustment that would drive stock negative is blocked.
    const over = await authPost(invToken, '/api/inventory/stock/adjust', {
      resourceId: id,
      delta: -99999,
      reason: 'CORRECTION',
    });
    expect(over.status).toBe(422);
    expect(String(over.body.error?.message ?? '')).toMatch(/on hand/i);
  });

  /* ── Phase 2.1: sales order → delivery challan → invoice ─────────── */
  it('sales order → delivery challan → invoice; stock OUT on dispatch (Phase 2.1)', async () => {
    const cust = await authPost(invToken, '/api/inventory/parties/customers', {
      name: `SO Cust ${Date.now()}`,
      phone: '9000000001',
    });
    expect(cust.status).toBe(201);
    const customerId = cust.body.data.id as string;

    const res = await authPost(invToken, '/api/resources', {
      name: `SO Item ${Date.now()}`,
      type: 'MATERIAL',
      unit: 'bag',
      rate: 200,
      gstRate: 18,
    });
    const resourceId = res.body.data.id as string;
    const open = await authPost(invToken, '/api/inventory/stock/opening-stock', {
      lines: [{ resourceId, quantity: 50 }],
    });
    expect(open.status).toBe(201);

    const so = await authPost(invToken, '/api/inventory/transactions/sales-orders', {
      customerId,
      customerName: 'SO Cust',
      orderDate: '2026-08-12',
      lines: [{ resourceId, quantity: 10, unit: 'bag', rate: 220, gstRate: 18 }],
    });
    expect(so.status).toBe(201);
    expect(so.body.data.status).toBe('DRAFT');
    expect(so.body.data.lines).toHaveLength(1);
    const soId = so.body.data.id as string;

    const confirm = await authPost(invToken, `/api/inventory/transactions/sales-orders/${soId}/action`, { action: 'confirm' });
    expect(confirm.status).toBe(200);
    expect(confirm.body.data.status).toBe('CONFIRMED');

    const dc = await authPost(invToken, '/api/inventory/transactions/delivery-challans', { salesOrderId: soId });
    expect(dc.status).toBe(201);
    expect(dc.body.data.status).toBe('DRAFT');
    const dcId = dc.body.data.id as string;

    const dispatch = await authPost(invToken, `/api/inventory/transactions/delivery-challans/${dcId}/dispatch`);
    expect(dispatch.status).toBe(200);
    expect(dispatch.body.data.status).toBe('DISPATCHED');
    expect(dispatch.body.data.draftInvoiceId).toBeTruthy();

    const deliver = await authPost(invToken, `/api/inventory/transactions/delivery-challans/${dcId}/deliver`);
    expect(deliver.status).toBe(200);
    expect(deliver.body.data.status).toBe('DELIVERED');

    // Stock OUT on dispatch: 50 → 40.
    const summary = await authGet(invToken, `/api/projects/${defaultProjectId}/procurement/stock/summary`);
    const row = (summary.body.data as Array<{ resourceId: string; balance: number }>).find(
      (r) => r.resourceId === resourceId,
    );
    expect(Number(row!.balance)).toBeCloseTo(40, 3);

    const invoicesAfterDispatch = await authGet(invToken, `/api/projects/${defaultProjectId}/invoices`);
    expect(invoicesAfterDispatch.status).toBe(200);
    const draftFromDispatch = (invoicesAfterDispatch.body.data as Array<{
      id: string;
      status: string;
      salesOrderId?: string | null;
    }>).find((i) => i.id === dispatch.body.data.draftInvoiceId);
    expect(draftFromDispatch).toBeTruthy();
    expect(draftFromDispatch!.status).toBe('DRAFT');
    expect(draftFromDispatch!.salesOrderId).toBe(soId);

    const soAfter = await authGet(invToken, `/api/inventory/transactions/sales-orders/${soId}`);
    expect(soAfter.status).toBe(200);
    expect(soAfter.body.data.status).toBe('INVOICED');
  });

  /* ── Phase 2.2/2.4: sales return restores stock + draft credit note ─ */
  it('sales return restores good stock and creates a GST draft credit note (Phase 2.2/2.4)', async () => {
    const res = await authPost(invToken, '/api/resources', {
      name: `SR Item ${Date.now()}`,
      type: 'MATERIAL',
      unit: 'bag',
      rate: 100,
      gstRate: 18,
    });
    const resourceId = res.body.data.id as string;
    const open = await authPost(invToken, '/api/inventory/stock/opening-stock', {
      lines: [{ resourceId, quantity: 20 }],
    });
    expect(open.status).toBe(201);

    const invRes = await authPost(invToken, `/api/projects/${defaultProjectId}/invoices`, {
      invoiceNumber: `P2INV-${Date.now()}`,
      projectId: defaultProjectId,
      clientName: 'Return Cust',
      invoiceDate: '2026-08-12',
      dueDate: '2026-08-27',
      lineItems: [{ description: 'Item', quantity: 5, unit: 'bag', rate: 100, gstRate: 18 }],
    });
    expect(invRes.status).toBe(201);
    const invoiceId = invRes.body.data.id as string;

    const ret = await authPost(invToken, '/api/inventory/transactions/returns/sales', {
      invoiceId,
      returnDate: '2026-08-13',
      reason: 'customer returned',
      lines: [{ resourceId, quantity: 3, unit: 'bag', rate: 100, gstRate: 18, returnKind: 'GOOD' }],
    });
    expect(ret.status).toBe(201);
    expect(ret.body.data.creditNoteId).toBeTruthy();

    // Stock restored: 20 → 23.
    const summary = await authGet(invToken, `/api/projects/${defaultProjectId}/procurement/stock/summary`);
    const row = (summary.body.data as Array<{ resourceId: string; balance: number }>).find(
      (r) => r.resourceId === resourceId,
    );
    expect(Number(row!.balance)).toBeCloseTo(23, 3);

    // Draft credit note with GST math: 3 × 100 + 18% = 354.
    const notes = await authGet(invToken, '/api/inventory/transactions/notes/credit');
    expect(notes.status).toBe(200);
    const cn = (notes.body.data as Array<{ id: string; salesReturnId: string | null; total: number }>).find(
      (n) => n.salesReturnId === ret.body.data.salesReturn.id,
    );
    expect(cn).toBeTruthy();
    expect(Number(cn!.total)).toBeCloseTo(354, 2);
  });

  /* ── Phase 2.3/2.4: purchase return reduces stock + draft debit note ─ */
  it('purchase return reduces stock and creates a draft debit note (Phase 2.3/2.4)', async () => {
    const res = await authPost(invToken, '/api/resources', {
      name: `PR Item ${Date.now()}`,
      type: 'MATERIAL',
      unit: 'bag',
      rate: 100,
      gstRate: 18,
    });
    const resourceId = res.body.data.id as string;
    const open = await authPost(invToken, '/api/inventory/stock/opening-stock', {
      lines: [{ resourceId, quantity: 30 }],
    });
    expect(open.status).toBe(201);

    const billRes = await authPost(invToken, `/api/projects/${defaultProjectId}/bills`, {
      billNumber: `P2BILL-${Date.now()}`,
      projectId: defaultProjectId,
      vendorName: 'Vendor X',
      billDate: '2026-08-12',
      subtotal: 1000,
      gstAmount: 180,
      category: 'MATERIAL',
    });
    expect(billRes.status).toBe(201);
    const billId = billRes.body.data.id as string;

    const pret = await authPost(invToken, '/api/inventory/transactions/returns/purchase', {
      billId,
      returnDate: '2026-08-13',
      reason: 'wrong item',
      lines: [{ resourceId, quantity: 10, unit: 'bag', rate: 100, gstRate: 18 }],
    });
    expect(pret.status).toBe(201);
    expect(pret.body.data.debitNoteId).toBeTruthy();

    const summary = await authGet(invToken, `/api/projects/${defaultProjectId}/procurement/stock/summary`);
    const row = (summary.body.data as Array<{ resourceId: string; balance: number }>).find(
      (r) => r.resourceId === resourceId,
    );
    expect(Number(row!.balance)).toBeCloseTo(20, 3);

    const notes = await authGet(invToken, '/api/inventory/transactions/notes/debit');
    expect(notes.status).toBe(200);
    expect(
      (notes.body.data as Array<{ purchaseReturnId: string | null }>).some(
        (n) => n.purchaseReturnId === pret.body.data.purchaseReturn.id,
      ),
    ).toBe(true);
  });

  /* ── Phase 2.5: customer credit-limit policy ──────────────────────── */
  it('enforces customer credit-limit policy (WARN default, BLOCK rejects) (Phase 2.5)', async () => {
    const cust = await authPost(invToken, '/api/inventory/parties/customers', {
      name: `CL Cust ${Date.now()}`,
      creditLimit: 100,
    });
    expect(cust.status).toBe(201);
    const customerId = cust.body.data.id as string;

    // WARN (default): invoice still created, warning surfaced.
    const invRes = await authPost(invToken, `/api/projects/${defaultProjectId}/invoices`, {
      invoiceNumber: `CLINV-${Date.now()}`,
      projectId: defaultProjectId,
      customerId,
      clientName: 'CL Cust',
      invoiceDate: '2026-08-12',
      dueDate: '2026-08-27',
      lineItems: [{ description: 'Item', quantity: 2, unit: 'bag', rate: 1000, gstRate: 18 }],
    });
    expect(invRes.status).toBe(201);
    expect(invRes.body.data.creditLimitWarning).toBeTruthy();

    // BLOCK: invoice rejected.
    const put = await request(app)
      .put('/api/settings/company')
      .set('Authorization', `Bearer ${invToken}`)
      .send({ creditLimitPolicy: 'BLOCK' });
    expect(put.status).toBe(200);
    expect(put.body.data.creditLimitPolicy).toBe('BLOCK');

    const blocked = await authPost(invToken, `/api/projects/${defaultProjectId}/invoices`, {
      invoiceNumber: `CLINV2-${Date.now()}`,
      projectId: defaultProjectId,
      customerId,
      clientName: 'CL Cust',
      invoiceDate: '2026-08-12',
      dueDate: '2026-08-27',
      lineItems: [{ description: 'Item', quantity: 2, unit: 'bag', rate: 1000, gstRate: 18 }],
    });
    expect(blocked.status).toBe(422);
    expect(String(blocked.body.error?.message ?? '')).toMatch(/credit limit/i);
  });

  /* ── Assistant scoping ────────────────────────────────────────────── */
  it('denies construction-only assistant tools for inventory accounts', async () => {
    const identity = await resolveAssistantIdentity(companyId, invUserId);
    expect(identity.productMode).toBe('inventory');
    await expect(
      executeAssistantTool(identity, 'list_estimates', { projectId: defaultProjectId }),
    ).rejects.toThrow(/not allowed/i);
  });

  /* ── INVENTORY_UX_POLISH D9: multi-material procure + retrieve ────── */
  it('procures and issues multiple materials in one go (D9)', async () => {
    const suffix = `D9-${Date.now()}`;
    const mk = async (name: string, unit: string, rate: number) => {
      const res = await authPost(invToken, '/api/resources', {
        name: `${name} ${suffix}`,
        type: 'MATERIAL',
        unit,
        rate,
        gstRate: 18,
      });
      expect(res.status).toBe(201);
      return res.body.data.id as string;
    };
    const cementId = await mk('D9 Cement', 'bag', 350);
    const steelId = await mk('D9 Steel', 'kg', 90);

    // 1. Multi-material indent → ONE APPROVED indent with 2 lines.
    const reqRes = await authPost(
      invToken,
      `/api/projects/${defaultProjectId}/procurement/requisitions`,
      {
        lines: [
          { resourceId: cementId, quantity: 10, unit: 'bag' },
          { resourceId: steelId, quantity: 100, unit: 'kg' },
        ],
      },
    );
    expect(reqRes.status).toBe(201);
    expect(reqRes.body.data.status).toBe('APPROVED');
    expect(reqRes.body.data.lines).toHaveLength(2);
    const reqId = reqRes.body.data.id as string;

    // 2. One PO covering both lines.
    const poRes = await authPost(
      invToken,
      `/api/projects/${defaultProjectId}/procurement/purchase-orders`,
      {
        poNumber: `PO-${suffix}`,
        vendorName: 'D9 Vendor',
        requisitionId: reqId,
        lines: [
          { resourceId: cementId, quantity: 10, unit: 'bag', rate: 340 },
          { resourceId: steelId, quantity: 100, unit: 'kg', rate: 88 },
        ],
      },
    );
    expect(poRes.status).toBe(201);
    expect(poRes.body.data.lines).toHaveLength(2);
    const poId = poRes.body.data.id as string;

    // 3. One GRN receiving both lines → stock per material.
    const grnRes = await authPost(
      invToken,
      `/api/projects/${defaultProjectId}/procurement/grn`,
      {
        grnNumber: `GRN-${suffix}`,
        purchaseOrderId: poId,
        receivedDate: new Date().toISOString().slice(0, 10),
        lines: [
          { resourceId: cementId, quantity: 10, unit: 'bag' },
          { resourceId: steelId, quantity: 100, unit: 'kg' },
        ],
      },
    );
    expect(grnRes.status).toBe(201);

    const balOf = async (resourceId: string): Promise<number> => {
      const res = await authGet(
        invToken,
        `/api/projects/${defaultProjectId}/procurement/stock/summary`,
      );
      const row = (res.body.data as Array<{ resourceId: string; balance: number }>).find(
        (r) => r.resourceId === resourceId,
      );
      return row ? Number(row.balance) : 0;
    };
    expect(await balOf(cementId)).toBeCloseTo(10, 3);
    expect(await balOf(steelId)).toBeCloseTo(100, 3);

    // 4. Multi-material issue → balances decrement + ONE draft invoice with 2 lines.
    const issueRes = await authPost(
      invToken,
      `/api/projects/${defaultProjectId}/procurement/stock/issue`,
      {
        lines: [
          { resourceId: cementId, quantity: 3, unitPrice: 420 },
          { resourceId: steelId, quantity: 20, unitPrice: 100 },
        ],
        customerName: 'D9 Buyer',
        notes: 'bulk sale',
      },
    );
    expect(issueRes.status).toBe(201);
    expect(issueRes.body.data.lines).toHaveLength(2);
    expect(issueRes.body.data.movementIds).toHaveLength(2);
    expect(issueRes.body.data.draftInvoiceId).toBeTruthy();
    expect(await balOf(cementId)).toBeCloseTo(7, 3);
    expect(await balOf(steelId)).toBeCloseTo(80, 3);

    const invoicesAfterIssue = await authGet(
      invToken,
      `/api/projects/${defaultProjectId}/invoices`,
    );
    expect(invoicesAfterIssue.status).toBe(200);
    const draftId = issueRes.body.data.draftInvoiceId as string;
    const listHit = (invoicesAfterIssue.body.data as Array<{
      id: string;
      clientName: string;
      stockMovementId?: string | null;
    }>).find((i) => i.id === draftId);
    expect(listHit).toBeTruthy();
    expect(listHit!.clientName).toBe('D9 Buyer');
    expect(listHit!.stockMovementId).toBe(issueRes.body.data.movementId);

    // Detail endpoint carries line items (list omits them).
    const draftDetail = await authGet(invToken, `/api/invoices/${draftId}`);
    expect(draftDetail.status).toBe(200);
    const draft = draftDetail.body.data as {
      subtotal: number;
      lineItems: Array<{ description: string }>;
    };
    expect(draft.lineItems).toHaveLength(2);
    expect(Number(draft.subtotal)).toBeCloseTo(3 * 420 + 20 * 100, 2);

    // 5. Over-issue on ONE line rolls back the whole request (nothing partial).
    const overRes = await authPost(
      invToken,
      `/api/projects/${defaultProjectId}/procurement/stock/issue`,
      {
        lines: [
          { resourceId: cementId, quantity: 1 }, // fine on its own
          { resourceId: steelId, quantity: 999999 }, // exceeds on-hand
        ],
      },
    );
    expect(overRes.status).toBe(422);
    expect(String(overRes.body.error?.message ?? '')).toMatch(/on hand/i);
    expect(await balOf(cementId)).toBeCloseTo(7, 3); // untouched by failed request
    expect(await balOf(steelId)).toBeCloseTo(80, 3);

    // 6. Legacy single-resource body still works (backward compatibility).
    const legacyRes = await authPost(
      invToken,
      `/api/projects/${defaultProjectId}/procurement/stock/issue`,
      { resourceId: cementId, quantity: 1, unitPrice: 420 },
    );
    expect(legacyRes.status).toBe(201);
    expect(legacyRes.body.data.movementIds).toHaveLength(1);
    expect(legacyRes.body.data.lines).toHaveLength(1);
    expect(await balOf(cementId)).toBeCloseTo(6, 3);
  });

  /* ── INVENTORY_HORIZONTAL_PLATFORM (Phase 3): warehouse ops ──────── */
  it('creates warehouses; stock is independent per location (Phase 3.1)', async () => {
    const whs = await authGet(invToken, '/api/inventory/warehouses');
    expect(whs.status).toBe(200);
    const defaultWh = (whs.body.data as Array<{ id: string; isDefault: boolean; name: string }>).find(
      (w) => w.isDefault,
    );
    expect(defaultWh).toBeTruthy();

    // Second location - not the default.
    const mk = await authPost(invToken, '/api/inventory/warehouses', {
      name: 'Secondary Store',
      code: `SEC-${suffix.slice(-4)}`,
      address: 'Plot 22, Uppal',
    });
    expect(mk.status).toBe(201);
    const secId = mk.body.data.id as string;
    expect(mk.body.data.isDefault).toBe(false);

    // Same item, independent balances per location via adjust + locationId.
    const itemRes = await authPost(invToken, '/api/resources', {
      name: `WH Item ${suffix}`,
      type: 'MATERIAL',
      unit: 'pcs',
      rate: 10,
      gstRate: 18,
    });
    expect(itemRes.status).toBe(201);
    const itemId = itemRes.body.data.id as string;

    const adj1 = await authPost(invToken, '/api/inventory/stock/adjust', {
      resourceId: itemId,
      delta: 5,
      reason: 'OTHER',
      locationId: defaultWh!.id,
    });
    expect(adj1.status).toBe(201);
    const adj2 = await authPost(invToken, '/api/inventory/stock/adjust', {
      resourceId: itemId,
      delta: 3,
      reason: 'OTHER',
      locationId: secId,
    });
    expect(adj2.status).toBe(201);

    const balAt = async (locationId: string): Promise<number> => {
      const s = await authGet(
        invToken,
        `/api/projects/${defaultProjectId}/procurement/stock/summary?locationId=${locationId}`,
      );
      const row = (s.body.data as Array<{ resourceId: string; balance: number }>).find(
        (r) => r.resourceId === itemId,
      );
      return row ? Number(row.balance) : 0;
    };
    expect(await balAt(defaultWh!.id)).toBeCloseTo(5, 3);
    expect(await balAt(secId)).toBeCloseTo(3, 3);

    // Promoting the secondary to default swaps the company default.
    const promote = await authPut(invToken, `/api/inventory/warehouses/${secId}`, { isDefault: true });
    expect(promote.status).toBe(200);
    const after = await authGet(invToken, '/api/inventory/warehouses');
    const newDefault = (after.body.data as Array<{ id: string; isDefault: boolean }>).find(
      (w) => w.isDefault,
    );
    expect(newDefault!.id).toBe(secId);
  });

  it('transfers stock A → B; insufficient source stock → 422 (Phase 3.2)', async () => {
    const whs = await authGet(invToken, '/api/inventory/warehouses');
    const locs = whs.body.data as Array<{ id: string; isDefault: boolean; name: string }>;
    const from = locs.find((w) => w.isDefault)!;
    const to = locs.find((w) => !w.isDefault)!;

    const itemRes = await authPost(invToken, '/api/resources', {
      name: `Transfer Item ${suffix}`,
      type: 'MATERIAL',
      unit: 'kg',
      rate: 20,
      gstRate: 18,
    });
    expect(itemRes.status).toBe(201);
    const itemId = itemRes.body.data.id as string;

    // Seed 10 kg at source.
    const seed = await authPost(invToken, '/api/inventory/stock/adjust', {
      resourceId: itemId,
      delta: 10,
      reason: 'OTHER',
      locationId: from.id,
    });
    expect(seed.status).toBe(201);

    const balOf = async (locationId: string): Promise<number> => {
      const s = await authGet(
        invToken,
        `/api/projects/${defaultProjectId}/procurement/stock/summary?locationId=${locationId}`,
      );
      const row = (s.body.data as Array<{ resourceId: string; balance: number }>).find(
        (r) => r.resourceId === itemId,
      );
      return row ? Number(row.balance) : 0;
    };
    expect(await balOf(from.id)).toBeCloseTo(10, 3);

    // Create + dispatch + receive a 4 kg transfer.
    const tr = await authPost(invToken, '/api/inventory/transfers', {
      fromLocationId: from.id,
      toLocationId: to.id,
      notes: 'monthly stock move',
      lines: [{ resourceId: itemId, quantity: 4 }],
    });
    expect(tr.status).toBe(201);
    expect(tr.body.data.status).toBe('DRAFT');
    expect(tr.body.data.transferNumber).toMatch(/^TF-/);
    const trId = tr.body.data.id as string;

    const dispatched = await authPost(invToken, `/api/inventory/transfers/${trId}/dispatch`);
    expect(dispatched.status).toBe(200);
    expect(dispatched.body.data.status).toBe('IN_TRANSIT');
    expect(await balOf(from.id)).toBeCloseTo(6, 3);
    expect(await balOf(to.id)).toBeCloseTo(0, 3);

    const received = await authPost(invToken, `/api/inventory/transfers/${trId}/receive`);
    expect(received.status).toBe(200);
    expect(received.body.data.status).toBe('RECEIVED');
    expect(await balOf(from.id)).toBeCloseTo(6, 3);
    expect(await balOf(to.id)).toBeCloseTo(4, 3);

    // Over-quantity (or items not on hand at source) rejected at create.
    const over = await authPost(invToken, '/api/inventory/transfers', {
      fromLocationId: from.id,
      toLocationId: to.id,
      lines: [{ resourceId: itemId, quantity: 999 }],
    });
    expect(over.status).toBe(422);
    expect(String(over.body.error?.message ?? '')).toMatch(/only 6 kg on hand/i);
    expect(await balOf(from.id)).toBeCloseTo(6, 3); // untouched
  });

  it('stock count approve writes STOCKTAKE adjustments (Phase 3.3)', async () => {
    const whs = await authGet(invToken, '/api/inventory/warehouses');
    const def = (whs.body.data as Array<{ id: string; isDefault: boolean }>).find((w) => w.isDefault)!;

    const itemRes = await authPost(invToken, '/api/resources', {
      name: `Count Item ${suffix}`,
      type: 'MATERIAL',
      unit: 'bag',
      rate: 50,
      gstRate: 18,
    });
    expect(itemRes.status).toBe(201);
    const itemId = itemRes.body.data.id as string;

    const seed = await authPost(invToken, '/api/inventory/stock/adjust', {
      resourceId: itemId,
      delta: 10,
      reason: 'OTHER',
      locationId: def.id,
    });
    expect(seed.status).toBe(201);

    // Physical count says 7 (system 10) → variance -3.
    const cnt = await authPost(invToken, '/api/inventory/stock-counts', {
      locationId: def.id,
      countDate: new Date().toISOString().slice(0, 10),
      notes: 'year-end stocktake',
      lines: [{ resourceId: itemId, countedQty: 7 }],
    });
    expect(cnt.status).toBe(201);
    expect(cnt.body.data.countNumber).toMatch(/^SC-/);
    expect(cnt.body.data.status).toBe('DRAFT');
    const line = cnt.body.data.lines.find((l: { resourceId: string }) => l.resourceId === itemId);
    expect(Number(line.systemQty)).toBeCloseTo(10, 3);
    expect(Number(line.variance)).toBeCloseTo(-3, 3);
    const cntId = cnt.body.data.id as string;

    // Approve → balance set to counted qty + STOCKTAKE adjustment movement.
    const approved = await authPost(invToken, `/api/inventory/stock-counts/${cntId}/approve`);
    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe('APPROVED');

    const summary = await authGet(
      invToken,
      `/api/projects/${defaultProjectId}/procurement/stock/summary?locationId=${def.id}`,
    );
    const row = (summary.body.data as Array<{ resourceId: string; balance: number }>).find(
      (r) => r.resourceId === itemId,
    );
    expect(Number(row?.balance)).toBeCloseTo(7, 3);

    const mv = await authGet(
      invToken,
      `/api/projects/${defaultProjectId}/procurement/stock/movements?resourceId=${itemId}&locationId=${def.id}`,
    );
    const adjust = (mv.body.data as Array<{ type: string; reason: string | null }>).find(
      (m) => m.type === 'ADJUST',
    );
    expect(adjust).toBeTruthy();
    expect(adjust!.reason).toBe('STOCKTAKE');
  });

  it('barcode identify resolves items; unknown code → 404 (Phase 3.4)', async () => {
    const code = `890${suffix.slice(-8)}`;
    const itemRes = await authPost(invToken, '/api/resources', {
      name: `Barcode Item ${suffix}`,
      type: 'MATERIAL',
      unit: 'pcs',
      rate: 30,
      gstRate: 18,
      barcode: code,
    });
    expect(itemRes.status).toBe(201);
    const itemId = itemRes.body.data.id as string;

    const hit = await authGet(invToken, `/api/inventory/items/by-barcode/${code}`);
    expect(hit.status).toBe(200);
    expect(hit.body.data.id).toBe(itemId);

    const miss = await authGet(invToken, '/api/inventory/items/by-barcode/NOPE-123');
    expect(miss.status).toBe(404);
  });

  it('construction tenants get 403 on all Phase 3 warehouse routes', async () => {
    const constToken = await loginAs(CONSTRUCTION_OWNER);
    expect((await authGet(constToken, '/api/inventory/warehouses')).status).toBe(403);
    expect((await authPost(constToken, '/api/inventory/warehouses', { name: 'X' })).status).toBe(403);
    expect((await authGet(constToken, '/api/inventory/transfers')).status).toBe(403);
    expect((await authGet(constToken, '/api/inventory/stock-counts')).status).toBe(403);
    expect((await authGet(constToken, '/api/inventory/items/by-barcode/abc')).status).toBe(403);
  });

  /* ── INVENTORY_HORIZONTAL_PLATFORM (Phase 4): procurement automation ── */
  it('persists reorder master fields on resources (Phase 4.1)', async () => {
    const vendorRes = await authPost(invToken, '/api/inventory/parties/vendors', {
      name: `Pref Vendor ${suffix}`,
      phone: '+919999999998',
    });
    expect(vendorRes.status).toBe(201);
    const vendorId = vendorRes.body.data.id as string;

    const itemRes = await authPost(invToken, '/api/resources', {
      name: `Reorder Item ${suffix}`,
      type: 'MATERIAL',
      unit: 'bag',
      rate: 100,
      gstRate: 18,
      reorderPoint: 10,
      preferredVendorId: vendorId,
      reorderQty: 50,
      leadTimeDays: 7,
    });
    expect(itemRes.status).toBe(201);
    const itemId = itemRes.body.data.id as string;

    const dbRow = await prisma.resource.findUniqueOrThrow({ where: { id: itemId } });
    expect(dbRow.preferredVendorId).toBe(vendorId);
    expect(Number(dbRow.reorderQty)).toBe(50);
    expect(dbRow.leadTimeDays).toBe(7);

    // Unknown/foreign vendor rejected.
    const bad = await authPost(invToken, '/api/resources', {
      name: `Bad Vendor Item ${suffix}`,
      type: 'MATERIAL',
      unit: 'pcs',
      rate: 1,
      gstRate: 18,
      preferredVendorId: '00000000-0000-4000-8000-000000000000',
    });
    expect(bad.status).toBe(404);
  });

  it('reorder suggestions list low-stock items; above reorder point excluded (Phase 4.2)', async () => {
    const lowRes = await authPost(invToken, '/api/resources', {
      name: `Low Item ${suffix}`,
      type: 'MATERIAL',
      unit: 'bag',
      rate: 100,
      gstRate: 18,
      reorderPoint: 10,
      reorderQty: 25,
    });
    expect(lowRes.status).toBe(201);
    const lowId = lowRes.body.data.id as string;

    const okRes = await authPost(invToken, '/api/resources', {
      name: `OK Item ${suffix}`,
      type: 'MATERIAL',
      unit: 'bag',
      rate: 100,
      gstRate: 18,
      reorderPoint: 10,
    });
    expect(okRes.status).toBe(201);
    const okId = okRes.body.data.id as string;
    const adj = await authPost(invToken, '/api/inventory/stock/adjust', {
      resourceId: okId,
      delta: 20,
      reason: 'OTHER',
    });
    expect(adj.status).toBe(201);

    const sugg = await authGet(invToken, '/api/inventory/reorder/suggestions');
    expect(sugg.status).toBe(200);
    const rows = sugg.body.data as Array<{ resourceId: string; onHand: number; suggestedQty: number }>;
    expect(rows.some((r) => r.resourceId === lowId)).toBe(true);
    expect(rows.some((r) => r.resourceId === okId)).toBe(false);
    const low = rows.find((r) => r.resourceId === lowId)!;
    expect(Number(low.onHand)).toBe(0);
    expect(Number(low.suggestedQty)).toBe(25); // reorderQty preferred over shortfall
  });

  it('one-click reorder creates auto-approved indent + PO with correct lines (Phase 4.3)', async () => {
    const lowRes = await authPost(invToken, '/api/resources', {
      name: `Click Item ${suffix}`,
      type: 'MATERIAL',
      unit: 'bag',
      rate: 120,
      gstRate: 18,
      reorderPoint: 10,
      reorderQty: 30,
    });
    expect(lowRes.status).toBe(201);
    const lowId = lowRes.body.data.id as string;

    const order = await authPost(invToken, '/api/inventory/reorder/suggestions/order', {
      resourceIds: [lowId],
    });
    expect(order.status).toBe(201);
    expect(order.body.data.requisition.status).toBe('APPROVED');
    // Thresholds are off (0) by default → PO auto-approves.
    expect(order.body.data.purchaseOrder.status).toBe('APPROVED');
    const poLine = order.body.data.purchaseOrder.lines.find(
      (l: { resourceId: string }) => l.resourceId === lowId,
    );
    expect(Number(poLine.quantity)).toBe(30);
    expect(Number(poLine.rate)).toBe(120);

    // Ordering an item that is NOT low-stock → 422.
    const okRes = await authPost(invToken, '/api/resources', {
      name: `Not Low ${suffix}`,
      type: 'MATERIAL',
      unit: 'bag',
      rate: 10,
      gstRate: 18,
      reorderPoint: 5,
    });
    expect(okRes.status).toBe(201);
    const okId = okRes.body.data.id as string;
    const seed = await authPost(invToken, '/api/inventory/stock/adjust', {
      resourceId: okId,
      delta: 100,
      reason: 'OTHER',
    });
    expect(seed.status).toBe(201);
    const noOrder = await authPost(invToken, '/api/inventory/reorder/suggestions/order', {
      resourceIds: [okId],
    });
    expect(noOrder.status).toBe(422);
  });

  it('PO approval bands: auto → manager → owner (Phase 4.4)', async () => {
    const setRes = await request(app)
      .put('/api/settings/company')
      .set('Authorization', `Bearer ${invToken}`)
      .send({ poAutoApproveBelow: 1000, poOwnerApproveAbove: 10000 });
    expect(setRes.status).toBe(200);

    const mkItem = async (name: string): Promise<string> => {
      const r = await authPost(invToken, '/api/resources', {
        name,
        type: 'MATERIAL',
        unit: 'bag',
        rate: 0,
        gstRate: 18,
      });
      expect(r.status).toBe(201);
      return r.body.data.id as string;
    };
    const mkPo = async (itemId: string, qty: number, rate: number) => {
      const req = await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/requisitions`, {
        lines: [{ resourceId: itemId, quantity: qty, unit: 'bag' }],
      });
      expect(req.status).toBe(201);
      const po = await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/purchase-orders`, {
        poNumber: `PO-BAND-${suffix}-${qty}-${rate}`,
        vendorName: 'Band Vendor',
        requisitionId: req.body.data.id as string,
        lines: [{ resourceId: itemId, quantity: qty, unit: 'bag', rate }],
      });
      expect(po.status).toBe(201);
      return po.body.data as { id: string; status: string; totalAmount: string };
    };

    try {
      // Below auto threshold (1000) → APPROVED.
      const autoItem = await mkItem(`Band Auto ${suffix}`);
      const autoPo = await mkPo(autoItem, 1, 500); // total 500
      expect(autoPo.status).toBe('APPROVED');

      // Mid band (1000..10000) → SUBMITTED (manager approves).
      const midItem = await mkItem(`Band Mid ${suffix}`);
      const midPo = await mkPo(midItem, 2, 3000); // total 6000
      expect(midPo.status).toBe('SUBMITTED');

      // Above owner threshold (10000) → SUBMITTED (owner only).
      const hiItem = await mkItem(`Band Hi ${suffix}`);
      const hiPo = await mkPo(hiItem, 5, 4000); // total 20000
      expect(hiPo.status).toBe('SUBMITTED');

      // Accept an INVENTORY_MANAGER to exercise the manager band.
      const inviteRes = await authPost(invToken, '/api/settings/users/invite', {
        email: `im-band-${suffix}@example.com`,
        role: 'INVENTORY_MANAGER',
      });
      expect(inviteRes.status).toBe(201);
      const acceptRes = await request(app).post('/api/auth/accept-invite').send({
        token: inviteRes.body.data.token as string,
        name: 'Band Manager',
        password: PASSWORD,
      });
      expect(acceptRes.status).toBe(201);
      const imToken = acceptRes.body.data.accessToken as string;

      // Manager CAN approve the mid-band PO.
      const midApprove = await authPost(
        imToken,
        `/api/projects/${defaultProjectId}/procurement/purchase-orders/${midPo.id}/approve`,
      );
      expect(midApprove.status).toBe(200);
      expect(midApprove.body.data.status).toBe('APPROVED');

      // Manager CANNOT approve the above-band PO (owner only).
      const hiApprove = await authPost(
        imToken,
        `/api/projects/${defaultProjectId}/procurement/purchase-orders/${hiPo.id}/approve`,
      );
      expect(hiApprove.status).toBe(403);

      // Owner CAN approve the above-band PO.
      const hiApproveOwner = await authPost(
        invToken,
        `/api/projects/${defaultProjectId}/procurement/purchase-orders/${hiPo.id}/approve`,
      );
      expect(hiApproveOwner.status).toBe(200);
      expect(hiApproveOwner.body.data.status).toBe('APPROVED');
    } finally {
      await request(app)
        .put('/api/settings/company')
        .set('Authorization', `Bearer ${invToken}`)
        .send({ poAutoApproveBelow: 0, poOwnerApproveAbove: 0 });
    }
  });

  it('construction: 403 on Phase 4 reorder routes; banding settings stripped (Phase 4)', async () => {
    const constToken = await loginAs(CONSTRUCTION_OWNER);
    expect((await authGet(constToken, '/api/inventory/reorder/suggestions')).status).toBe(403);
    expect(
      (
        await authPost(constToken, '/api/inventory/reorder/suggestions/order', {
          resourceIds: ['00000000-0000-4000-8000-000000000000'],
        })
      ).status,
    ).toBe(403);

    // Construction companies cannot enable the banding (fields stripped server-side).
    const setRes = await request(app)
      .put('/api/settings/company')
      .set('Authorization', `Bearer ${constToken}`)
      .send({ poAutoApproveBelow: 5000, poOwnerApproveAbove: 90000 });
    expect(setRes.status).toBe(200);
    const constOwner = await prisma.user.findFirstOrThrow({ where: { email: CONSTRUCTION_OWNER } });
    const constCompany = await prisma.company.findUniqueOrThrow({
      where: { id: constOwner.companyId },
      select: { poAutoApproveBelow: true, poOwnerApproveAbove: true },
    });
    expect(Number(constCompany.poAutoApproveBelow)).toBe(0);
    expect(Number(constCompany.poOwnerApproveAbove)).toBe(0);
  });

  /* ── INVENTORY_HORIZONTAL_PLATFORM (Phase 5): finance depth ──────── */
  it('landed cost allocation + WAC on GRN (Phase 5.1/5.2)', async () => {
    const itemRes = await authPost(invToken, '/api/resources', {
      name: `LC Item ${suffix}`,
      type: 'MATERIAL',
      unit: 'bag',
      rate: 100,
      gstRate: 18,
    });
    expect(itemRes.status).toBe(201);
    const itemId = itemRes.body.data.id as string;

    const req = await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/requisitions`, {
      lines: [{ resourceId: itemId, quantity: 10, unit: 'bag' }],
    });
    expect(req.status).toBe(201);
    const po = await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/purchase-orders`, {
      poNumber: `PO-LC-${suffix}`,
      vendorName: 'LC Vendor',
      requisitionId: req.body.data.id as string,
      lines: [{ resourceId: itemId, quantity: 10, unit: 'bag', rate: 100 }],
    });
    expect(po.status).toBe(201);

    const grn = await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/grn`, {
      poNumber: `GRN-LC-${suffix}`,
      purchaseOrderId: po.body.data.id as string,
      receivedDate: '2026-08-12',
      freightCost: 1000,
      landedCostAllocation: 'QUANTITY',
      lines: [{ resourceId: itemId, quantity: 10, unit: 'bag' }],
    });
    expect(grn.status).toBe(201);
    // 1000 freight over 10 units → +100/unit → unitCost 200.
    const grnLine = grn.body.data.lines.find((l: { resourceId: string }) => l.resourceId === itemId);
    expect(Number(grnLine.unitCost)).toBeCloseTo(200, 2);

    const db = await prisma.resource.findUniqueOrThrow({ where: { id: itemId } });
    expect(Number(db.avgCost)).toBeCloseTo(200, 2); // WAC after first stock-in

    const mv = await prisma.stockMovement.findFirst({
      where: { referenceType: 'GRN', resourceId: itemId },
      orderBy: { createdAt: 'desc' },
    });
    expect(Number(mv?.unitCost)).toBeCloseTo(200, 2);
    expect(Number(mv?.inventoryValue)).toBeCloseTo(2000, 2);

    const summary = await authGet(invToken, `/api/projects/${defaultProjectId}/procurement/stock/summary`);
    const row = (summary.body.data as Array<{ resourceId: string; unitCost: number; inventoryValue: number }>).find(
      (r) => r.resourceId === itemId,
    );
    expect(Number(row?.unitCost)).toBeCloseTo(200, 2);
    expect(Number(row?.inventoryValue)).toBeCloseTo(2000, 2);
  });

  it('weighted-average cost updates across GRNs; OUT carries WAC (Phase 5.2)', async () => {
    const itemRes = await authPost(invToken, '/api/resources', {
      name: `WAC Item ${suffix}`,
      type: 'MATERIAL',
      unit: 'bag',
      rate: 0,
      gstRate: 18,
    });
    expect(itemRes.status).toBe(201);
    const itemId = itemRes.body.data.id as string;

    const grnOnce = async (qty: number, rate: number, tag: string) => {
      const req = await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/requisitions`, {
        lines: [{ resourceId: itemId, quantity: qty, unit: 'bag' }],
      });
      expect(req.status).toBe(201);
      const po = await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/purchase-orders`, {
        poNumber: `PO-WAC-${tag}-${suffix}`,
        vendorName: 'WAC Vendor',
        requisitionId: req.body.data.id as string,
        lines: [{ resourceId: itemId, quantity: qty, unit: 'bag', rate }],
      });
      expect(po.status).toBe(201);
      const grn = await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/grn`, {
        grnNumber: `GRN-WAC-${tag}-${suffix}`,
        purchaseOrderId: po.body.data.id as string,
        receivedDate: '2026-08-12',
        lines: [{ resourceId: itemId, quantity: qty, unit: 'bag' }],
      });
      expect(grn.status).toBe(201);
    };

    await grnOnce(10, 100, 'A'); // 10 @ 100 → avg 100
    let db = await prisma.resource.findUniqueOrThrow({ where: { id: itemId } });
    expect(Number(db.avgCost)).toBeCloseTo(100, 2);

    await grnOnce(10, 300, 'B'); // (1000 + 3000)/20 → avg 200
    db = await prisma.resource.findUniqueOrThrow({ where: { id: itemId } });
    expect(Number(db.avgCost)).toBeCloseTo(200, 2);

    // Issue 5 → OUT movement carries WAC 200; average unchanged.
    const issue = await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/stock/issue`, {
      lines: [{ resourceId: itemId, quantity: 5, unitPrice: 250 }],
    });
    expect(issue.status).toBe(201);
    const outMv = await prisma.stockMovement.findFirst({
      where: { referenceType: 'MANUAL_ISSUE', resourceId: itemId },
      orderBy: { createdAt: 'desc' },
    });
    expect(Number(outMv?.unitCost)).toBeCloseTo(200, 2);
    expect(Number(outMv?.inventoryValue)).toBeCloseTo(1000, 2);
    db = await prisma.resource.findUniqueOrThrow({ where: { id: itemId } });
    expect(Number(db.avgCost)).toBeCloseTo(200, 2);
  });

  it('customer ledger shows invoices, payments, credit notes + outstanding (Phase 5.3)', async () => {
    const custRes = await authPost(invToken, '/api/inventory/parties/customers', {
      name: `Ledger Cust ${suffix}`,
      creditLimit: 100000,
    });
    expect(custRes.status).toBe(201);
    const customerId = custRes.body.data.id as string;

    const invRes = await authPost(invToken, `/api/projects/${defaultProjectId}/invoices`, {
      invoiceNumber: `LGRINV-${suffix}`,
      projectId: defaultProjectId,
      customerId,
      clientName: 'Ledger Cust',
      invoiceDate: '2026-08-12',
      dueDate: '2026-08-27',
      gstRate: 0,
      lineItems: [{ description: 'Item', quantity: 2, unit: 'bag', rate: 1000, gstRate: 0 }],
    });
    expect(invRes.status).toBe(201);
    const invoiceId = invRes.body.data.id as string;

    const sendRes = await authPost(invToken, `/api/invoices/${invoiceId}/send`);
    expect(sendRes.status).toBe(200);

    const payRes = await authPost(invToken, `/api/invoices/${invoiceId}/record-payment`, { amount: 500 });
    expect(payRes.status).toBe(200);

    const itemRes = await authPost(invToken, '/api/resources', {
      name: `Ledger Item ${suffix}`,
      type: 'MATERIAL',
      unit: 'bag',
      rate: 100,
      gstRate: 18,
    });
    const itemId = itemRes.body.data.id as string;
    const retRes = await authPost(invToken, '/api/inventory/transactions/returns/sales', {
      invoiceId,
      returnDate: '2026-08-13',
      lines: [{ resourceId: itemId, quantity: 1, unit: 'bag', rate: 100, gstRate: 18 }],
    });
    expect(retRes.status).toBe(201);
    const cnId = retRes.body.data.creditNoteId as string;
    const issueRes = await authPost(invToken, `/api/inventory/transactions/notes/credit/${cnId}/issue`);
    expect(issueRes.status).toBe(200);

    const ledgerRes = await authGet(invToken, `/api/inventory/parties/customers/${customerId}/ledger`);
    expect(ledgerRes.status).toBe(200);
    // Outstanding = 2000 (invoice) − 500 (paid) − 118 (credit note) = 1382.
    expect(Number(ledgerRes.body.data.outstanding)).toBeCloseTo(1382, 2);
    const types = (ledgerRes.body.data.entries as Array<{ type: string }>).map((e) => e.type);
    expect(types).toContain('INVOICE');
    expect(types).toContain('PAYMENT');
    expect(types).toContain('CREDIT_NOTE');
  });

  it('credit note issue DRAFT → ISSUED and enters the Tally export (Phase 5.4)', async () => {
    const custRes = await authPost(invToken, '/api/inventory/parties/customers', {
      name: `Tally CN Cust ${suffix}`,
    });
    const customerId = custRes.body.data.id as string;
    const invRes = await authPost(invToken, `/api/projects/${defaultProjectId}/invoices`, {
      invoiceNumber: `TCNINV-${suffix}`,
      projectId: defaultProjectId,
      customerId,
      clientName: 'Tally CN Cust',
      invoiceDate: '2026-08-12',
      dueDate: '2026-08-27',
      lineItems: [{ description: 'Item', quantity: 1, unit: 'bag', rate: 500, gstRate: 18 }],
    });
    expect(invRes.status).toBe(201);
    const invoiceId = invRes.body.data.id as string;

    const itemRes = await authPost(invToken, '/api/resources', {
      name: `Tally CN Item ${suffix}`,
      type: 'MATERIAL',
      unit: 'bag',
      rate: 100,
      gstRate: 18,
    });
    const itemId = itemRes.body.data.id as string;
    const retRes = await authPost(invToken, '/api/inventory/transactions/returns/sales', {
      invoiceId,
      returnDate: '2026-08-13',
      lines: [{ resourceId: itemId, quantity: 1, unit: 'bag', rate: 100, gstRate: 18 }],
    });
    expect(retRes.status).toBe(201);
    const cnId = retRes.body.data.creditNoteId as string;
    const cn = await prisma.creditNote.findUniqueOrThrow({ where: { id: cnId } });
    expect(cn.status).toBe('DRAFT');

    const exportBefore = await request(app)
      .get(`/api/projects/${defaultProjectId}/financials/export-tally`)
      .set('Authorization', `Bearer ${invToken}`);
    expect(exportBefore.status).toBe(200);
    expect(String(exportBefore.text ?? '')).not.toContain(cn.creditNoteNumber);

    const issueRes = await authPost(invToken, `/api/inventory/transactions/notes/credit/${cnId}/issue`);
    expect(issueRes.status).toBe(200);
    expect(issueRes.body.data.status).toBe('ISSUED');

    const exportAfter = await request(app)
      .get(`/api/projects/${defaultProjectId}/financials/export-tally`)
      .set('Authorization', `Bearer ${invToken}`);
    expect(exportAfter.status).toBe(200);
    expect(String(exportAfter.text ?? '')).toContain(cn.creditNoteNumber);

    // Re-issue rejected.
    const reissue = await authPost(invToken, `/api/inventory/transactions/notes/credit/${cnId}/issue`);
    expect(reissue.status).toBe(400);
  });

  it('credit note GST split: same-state → CGST/SGST; inter-state → IGST (Phase 5.5)', async () => {
    const itemRes = await authPost(invToken, '/api/resources', {
      name: `GST Item ${suffix}`,
      type: 'MATERIAL',
      unit: 'bag',
      rate: 100,
      gstRate: 18,
    });
    expect(itemRes.status).toBe(201);
    const itemId = itemRes.body.data.id as string;

    const mkReturn = async (invoiceId: string) => {
      const ret = await authPost(invToken, '/api/inventory/transactions/returns/sales', {
        invoiceId,
        returnDate: '2026-08-13',
        lines: [{ resourceId: itemId, quantity: 1, unit: 'bag', rate: 100, gstRate: 18 }],
      });
      expect(ret.status).toBe(201);
      return ret.body.data.creditNoteId as string;
    };

    // Same-state customer (Telangana GSTIN, 36…) → CGST/SGST.
    const sameCust = await authPost(invToken, '/api/inventory/parties/customers', {
      name: `SameState ${suffix}`,
      gstin: uniqueGstin(),
    });
    expect(sameCust.status).toBe(201);
    const sameInv = await authPost(invToken, `/api/projects/${defaultProjectId}/invoices`, {
      invoiceNumber: `SSINV-${suffix}`,
      projectId: defaultProjectId,
      customerId: sameCust.body.data.id as string,
      clientName: 'SameState',
      clientGstin: uniqueGstin(),
      invoiceDate: '2026-08-12',
      dueDate: '2026-08-27',
      lineItems: [{ description: 'Item', quantity: 1, unit: 'bag', rate: 100, gstRate: 18 }],
    });
    expect(sameInv.status).toBe(201);
    const sameCnId = await mkReturn(sameInv.body.data.id as string);
    const sameCn = await prisma.creditNote.findUniqueOrThrow({ where: { id: sameCnId } });
    expect(Number(sameCn.cgstAmount)).toBeGreaterThan(0);
    expect(Number(sameCn.sgstAmount)).toBeGreaterThan(0);
    expect(Number(sameCn.igstAmount)).toBe(0);
    expect(Number(sameCn.cgstAmount) + Number(sameCn.sgstAmount)).toBeCloseTo(18, 2);

    // Inter-state customer (Maharashtra GSTIN, 27…) → IGST.
    const gstin27 = `27AABCR${suffix.slice(-4)}A1Z5`;
    const otherCust = await authPost(invToken, '/api/inventory/parties/customers', {
      name: `OtherState ${suffix}`,
      gstin: gstin27,
    });
    expect(otherCust.status).toBe(201);
    const otherInv = await authPost(invToken, `/api/projects/${defaultProjectId}/invoices`, {
      invoiceNumber: `OSINV-${suffix}`,
      projectId: defaultProjectId,
      customerId: otherCust.body.data.id as string,
      clientName: 'OtherState',
      clientGstin: gstin27,
      invoiceDate: '2026-08-12',
      dueDate: '2026-08-27',
      lineItems: [{ description: 'Item', quantity: 1, unit: 'bag', rate: 100, gstRate: 18 }],
    });
    expect(otherInv.status).toBe(201);
    const otherCnId = await mkReturn(otherInv.body.data.id as string);
    const otherCn = await prisma.creditNote.findUniqueOrThrow({ where: { id: otherCnId } });
    expect(Number(otherCn.igstAmount)).toBeCloseTo(18, 2);
    expect(Number(otherCn.cgstAmount)).toBe(0);
    expect(Number(otherCn.sgstAmount)).toBe(0);
  });

  /* ── Phase 6: analytics & tiers ──────────────────────────────────── */
  it('executive dashboard aggregates value, today sales/purchases, AR/AP (Phase 6.1)', async () => {
    const before = await authGet(invToken, '/api/inventory/analytics/dashboard');
    expect(before.status).toBe(200);

    // Item with known WAC: GRN 10 @ 200 → avgCost 200 → value 2000.
    // receivedDate is NOT IST-today so the auto-created DRAFT vendor bill
    // (createDraftBillFromGrn) is excluded from purchasesToday.
    const itemRes = await authPost(invToken, '/api/resources', {
      name: `Dash Item ${suffix}`,
      type: 'MATERIAL',
      unit: 'bag',
      rate: 150,
      gstRate: 18,
    });
    expect(itemRes.status).toBe(201);
    const itemId = itemRes.body.data.id as string;
    const req = await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/requisitions`, {
      lines: [{ resourceId: itemId, quantity: 10, unit: 'bag' }],
    });
    expect(req.status).toBe(201);
    const po = await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/purchase-orders`, {
      poNumber: `PO-DASH-${suffix}`,
      vendorName: 'Dash Vendor',
      requisitionId: req.body.data.id as string,
      lines: [{ resourceId: itemId, quantity: 10, unit: 'bag', rate: 200 }],
    });
    expect(po.status).toBe(201);
    const grn = await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/grn`, {
      grnNumber: `GRN-DASH-${suffix}`,
      purchaseOrderId: po.body.data.id as string,
      receivedDate: '2026-08-10',
      lines: [{ resourceId: itemId, quantity: 10, unit: 'bag' }],
    });
    expect(grn.status).toBe(201);

    // Invoice + bill dated IST-today so they land in salesToday/purchasesToday.
    const today = istToday();
    const cust = await authPost(invToken, '/api/inventory/parties/customers', {
      name: `Dash Cust ${suffix}`,
    });
    expect(cust.status).toBe(201);
    const invRes = await authPost(invToken, `/api/projects/${defaultProjectId}/invoices`, {
      invoiceNumber: `DASHINV-${suffix}`,
      projectId: defaultProjectId,
      customerId: cust.body.data.id as string,
      clientName: 'Dash Cust',
      invoiceDate: today,
      dueDate: today,
      gstRate: 0,
      lineItems: [{ description: 'Item', quantity: 1, unit: 'bag', rate: 3000, gstRate: 0 }],
    });
    expect(invRes.status).toBe(201);
    const sendRes = await authPost(invToken, `/api/invoices/${invRes.body.data.id}/send`);
    expect(sendRes.status).toBe(200);

    const billRes = await authPost(invToken, `/api/projects/${defaultProjectId}/bills`, {
      billNumber: `DASHBILL-${suffix}`,
      projectId: defaultProjectId,
      vendorName: 'Dash Vendor',
      billDate: today,
      subtotal: 5000,
      gstAmount: 0,
      category: 'MATERIAL',
    });
    expect(billRes.status).toBe(201);

    const after = await authGet(invToken, '/api/inventory/analytics/dashboard');
    expect(after.status).toBe(200);
    const b = before.body.data as Record<string, number>;
    const a = after.body.data as Record<string, number>;
    for (const key of [
      'inventoryValue',
      'salesToday',
      'purchasesToday',
      'receivables',
      'payables',
      'lowStockCount',
      'deadStockCount',
    ]) {
      expect(typeof a[key]).toBe('number');
    }
    expect(Number(a.inventoryValue)).toBeCloseTo(Number(b.inventoryValue) + 2000, 2); // 10 × WAC 200
    expect(Number(a.salesToday)).toBeCloseTo(Number(b.salesToday) + 3000, 2);
    expect(Number(a.purchasesToday)).toBeCloseTo(Number(b.purchasesToday) + 5000, 2);
    expect(Number(a.receivables)).toBeCloseTo(Number(b.receivables) + 3000, 2);
    expect(Number(a.payables)).toBeCloseTo(Number(b.payables) + 5000, 2);
  });

  it('classifies dead stock (no OUT in N days) + per-warehouse value (Phase 6.2)', async () => {
    // Dead item: GRN 10 @ 100, never issued.
    const deadRes = await authPost(invToken, '/api/resources', {
      name: `Dead Item ${suffix}`,
      type: 'MATERIAL',
      unit: 'bag',
      rate: 120,
      gstRate: 18,
    });
    const deadItemId = deadRes.body.data.id as string;
    const grnStock = async (itemId: string, tag: string) => {
      const req = await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/requisitions`, {
        lines: [{ resourceId: itemId, quantity: 10, unit: 'bag' }],
      });
      expect(req.status).toBe(201);
      const po = await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/purchase-orders`, {
        poNumber: `PO-HL-${tag}-${suffix}`,
        vendorName: 'Health Vendor',
        requisitionId: req.body.data.id as string,
        lines: [{ resourceId: itemId, quantity: 10, unit: 'bag', rate: 100 }],
      });
      expect(po.status).toBe(201);
      const grn = await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/grn`, {
        grnNumber: `GRN-HL-${tag}-${suffix}`,
        purchaseOrderId: po.body.data.id as string,
        receivedDate: '2026-08-12',
        lines: [{ resourceId: itemId, quantity: 10, unit: 'bag' }],
      });
      expect(grn.status).toBe(201);
    };
    await grnStock(deadItemId, 'DEAD');

    // Live item: GRN 10 @ 100 then issue 3 → active with OUT movement.
    const liveRes = await authPost(invToken, '/api/resources', {
      name: `Live Item ${suffix}`,
      type: 'MATERIAL',
      unit: 'bag',
      rate: 150,
      gstRate: 18,
    });
    const liveItemId = liveRes.body.data.id as string;
    await grnStock(liveItemId, 'LIVE');
    const issue = await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/stock/issue`, {
      lines: [{ resourceId: liveItemId, quantity: 3, unitPrice: 150 }],
    });
    expect(issue.status).toBe(201);

    const health = await authGet(invToken, '/api/inventory/analytics/reports/stock-health?days=90');
    expect(health.status).toBe(200);
    const rows = health.body.data as Array<{
      resourceId: string;
      classification: string;
      onHand: number;
      daysSinceLastOut: number | null;
    }>;
    const deadRow = rows.find((r) => r.resourceId === deadItemId);
    const liveRow = rows.find((r) => r.resourceId === liveItemId);
    expect(deadRow?.classification).toBe('DEAD');
    expect(Number(deadRow?.onHand)).toBeCloseTo(10, 2);
    expect(liveRow?.classification).toBe('ACTIVE');
    expect(Number(liveRow?.onHand)).toBeCloseTo(7, 2);
    expect(Number(liveRow?.daysSinceLastOut)).toBeLessThan(1);

    // Warehouse value summary + locationId filter keep the same classification.
    const wh = await authGet(invToken, '/api/inventory/analytics/reports/warehouse');
    expect(wh.status).toBe(200);
    const location = (wh.body.data as Array<{ locationId: string; value: number; itemCount: number }>)[0];
    expect(location).toBeTruthy();
    expect(Number(location.value)).toBeGreaterThanOrEqual(1700); // dead 10×100 + live 7×100

    const filtered = await authGet(
      invToken,
      `/api/inventory/analytics/reports/stock-health?days=90&locationId=${location.locationId}`,
    );
    expect(filtered.status).toBe(200);
    const fDead = (filtered.body.data as Array<{ resourceId: string; classification: string }>).find(
      (r) => r.resourceId === deadItemId,
    );
    expect(fDead?.classification).toBe('DEAD');

    // Dashboard dead-stock count picks the un-issued item up.
    const dash = await authGet(invToken, '/api/inventory/analytics/dashboard');
    expect(Number(dash.body.data.deadStockCount)).toBeGreaterThanOrEqual(1);
  });

  it('margin report computes revenue − WAC×qty sold with known WAC + sell rate (Phase 6.3)', async () => {
    const itemRes = await authPost(invToken, '/api/resources', {
      name: `Margin Item ${suffix}`,
      type: 'MATERIAL',
      unit: 'bag',
      rate: 150,
      gstRate: 18,
    });
    expect(itemRes.status).toBe(201);
    const itemId = itemRes.body.data.id as string;

    const req = await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/requisitions`, {
      lines: [{ resourceId: itemId, quantity: 10, unit: 'bag' }],
    });
    expect(req.status).toBe(201);
    const po = await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/purchase-orders`, {
      poNumber: `PO-MGN-${suffix}`,
      vendorName: 'Margin Vendor',
      requisitionId: req.body.data.id as string,
      lines: [{ resourceId: itemId, quantity: 10, unit: 'bag', rate: 100 }],
    });
    expect(po.status).toBe(201);
    const grn = await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/grn`, {
      grnNumber: `GRN-MGN-${suffix}`,
      purchaseOrderId: po.body.data.id as string,
      receivedDate: '2026-08-12',
      lines: [{ resourceId: itemId, quantity: 10, unit: 'bag' }],
    });
    expect(grn.status).toBe(201);
    const db = await prisma.resource.findUniqueOrThrow({ where: { id: itemId } });
    expect(Number(db.avgCost)).toBeCloseTo(100, 2); // WAC 100

    // Sell 5 @ catalog rate 150 → revenue 750, COGS 500, margin 250 (33.3%).
    const issue = await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/stock/issue`, {
      lines: [{ resourceId: itemId, quantity: 5, unitPrice: 150 }],
    });
    expect(issue.status).toBe(201);

    const margin = await authGet(invToken, '/api/inventory/analytics/reports/margin');
    expect(margin.status).toBe(200);
    const row = (margin.body.data as Array<{
      resourceId: string;
      qtySold: number;
      revenue: number;
      cogs: number;
      margin: number;
      marginPct: number;
    }>).find((r) => r.resourceId === itemId);
    expect(Number(row?.qtySold)).toBeCloseTo(5, 2);
    expect(Number(row?.revenue)).toBeCloseTo(750, 2); // 5 × catalog rate 150
    expect(Number(row?.cogs)).toBeCloseTo(500, 2); // 5 × WAC 100
    expect(Number(row?.margin)).toBeCloseTo(250, 2);
    expect(Number(row?.marginPct)).toBeCloseTo(33.3, 1);
  });

  it('purchase price history reports last buy rate vs current WAC (Phase 6.3)', async () => {
    const itemRes = await authPost(invToken, '/api/resources', {
      name: `PH Item ${suffix}`,
      type: 'MATERIAL',
      unit: 'bag',
      rate: 0,
      gstRate: 18,
    });
    expect(itemRes.status).toBe(201);
    const itemId = itemRes.body.data.id as string;

    const grnOnce = async (rate: number, tag: string, receivedDate: string) => {
      const req = await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/requisitions`, {
        lines: [{ resourceId: itemId, quantity: 10, unit: 'bag' }],
      });
      expect(req.status).toBe(201);
      const po = await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/purchase-orders`, {
        poNumber: `PO-PH-${tag}-${suffix}`,
        vendorName: 'PH Vendor',
        requisitionId: req.body.data.id as string,
        lines: [{ resourceId: itemId, quantity: 10, unit: 'bag', rate }],
      });
      expect(po.status).toBe(201);
      const grn = await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/grn`, {
        grnNumber: `GRN-PH-${tag}-${suffix}`,
        purchaseOrderId: po.body.data.id as string,
        receivedDate,
        lines: [{ resourceId: itemId, quantity: 10, unit: 'bag' }],
      });
      expect(grn.status).toBe(201);
    };
    // Distinct received dates so "last buy" is deterministic (GRN B = latest).
    await grnOnce(100, 'A', '2026-08-10'); // 10 @ 100
    await grnOnce(300, 'B', '2026-08-15'); // 10 @ 300 → WAC (1000+3000)/20 = 200

    const ph = await authGet(invToken, '/api/inventory/analytics/reports/purchase-history');
    expect(ph.status).toBe(200);
    const row = (ph.body.data as Array<{
      resourceId: string;
      lastBuyRate: number;
      lastBuyDate: string | null;
      currentWac: number;
      wacVsLastBuy: number;
    }>).find((r) => r.resourceId === itemId);
    expect(Number(row?.currentWac)).toBeCloseTo(200, 2);
    expect(Number(row?.lastBuyRate)).toBeCloseTo(300, 2);
    expect(Number(row?.wacVsLastBuy)).toBeCloseTo(-100, 2);
    expect(row?.lastBuyDate).toBeTruthy();
  });

  it('construction tenants get 403 on all Phase 6 analytics routes', async () => {
    const constToken = await loginAs(CONSTRUCTION_OWNER);
    const paths = [
      '/api/inventory/analytics/dashboard',
      '/api/inventory/analytics/reports/stock-health',
      '/api/inventory/analytics/reports/warehouse',
      '/api/inventory/analytics/reports/margin',
      '/api/inventory/analytics/reports/purchase-history',
    ];
    for (const p of paths) {
      const res = await authGet(constToken, p);
      expect(res.status).toBe(403);
    }
  });

  it('construction tenants get 403 on Phase 5 ledger + note-issue routes', async () => {
    const constToken = await loginAs(CONSTRUCTION_OWNER);
    const uuid = '00000000-0000-4000-8000-000000000000';
    expect((await authGet(constToken, `/api/inventory/parties/customers/${uuid}/ledger`)).status).toBe(403);
    expect((await authGet(constToken, `/api/inventory/parties/vendors/${uuid}/ledger`)).status).toBe(403);
    expect((await authPost(constToken, `/api/inventory/transactions/notes/credit/${uuid}/issue`)).status).toBe(403);
    expect((await authPost(constToken, `/api/inventory/transactions/notes/debit/${uuid}/issue`)).status).toBe(403);
  });
  /* ── Phase 7: AI layer (OCR draft bill, import mapping, anomalies, tools) ── */

  it('7.1 bill extract route returns a reviewable draft or a graceful note (does not persist)', async () => {
    const res = await authPost(invToken, '/api/inventory/ai/bills/extract', {
      fileContent: Buffer.from(
        'Invoice from ABC Suppliers Inv No: INV-001 Date: 2025-04-01 Subtotal: Rs 10,000 GST: Rs 1,800',
        'utf8',
      ).toString('base64'),
      filename: 'invoice.txt',
      contentType: 'text/plain',
    });
    // LLM may be configured (platform env) or not - either way the route must
    // return 200 with `{ draft, notes }` and never write a bill.
    expect(res.status).toBe(200);
    const data = res.body.data as { draft: { vendorName: string } | null; notes: string };
    expect(typeof data.notes).toBe('string');
    expect(data.notes.length).toBeGreaterThan(0);
    if (data.draft) {
      expect(typeof data.draft.vendorName).toBe('string');
    }
  });

  it('7.1 create-from-draft writes a DRAFT vendor bill with AI_EXTRACT snapshot', async () => {
    const billNumber = `AIBILL-${suffix}`;
    const res = await authPost(invToken, '/api/inventory/ai/bills/create-from-draft', {
      draft: {
        vendorName: 'AI Vendor',
        vendorGstin: '36AIBILL2341A1Z',
        billNumber,
        billDate: '2025-04-01',
        subtotal: 10000,
        gstAmount: 1800,
        tdsAmount: 0,
        total: 11800,
        category: 'MATERIAL',
        confidence: 0.9,
        lines: [
          { description: 'AI Cement', hsn: '2523', unit: 'bag', quantity: 500, rate: 20, gstRate: 18, amount: 10000 },
        ],
      },
    });
    expect(res.status).toBe(201);
    expect(res.body.data.bill.status).toBe('DRAFT');
    expect(res.body.data.bill.vendorName).toBe('AI Vendor');

    const saved = await prisma.bill.findUniqueOrThrow({ where: { companyId_billNumber: { companyId, billNumber } } });
    const snapshot = saved.billSnapshot as { source: string; lines: Array<{ description: string; hsn: string }> };
    expect(snapshot.source).toBe('AI_EXTRACT');
    expect(snapshot.lines).toHaveLength(1);
    expect(snapshot.lines[0]!.hsn).toBe('2523');
  });

  it('7.2 import preview maps columns and CATALOG confirm creates resources', async () => {
    const preview = await authPost(invToken, '/api/inventory/ai/import/preview', {
      fileContent: Buffer.from(
        'Product Name,Unit,HSN,Rate,GST %,Opening Qty\nAI Cement,bags,2523,350,18,500\nAI Steel,kg,7208,88,18,1200',
        'utf8',
      ).toString('base64'),
      filename: 'catalog.csv',
      contentType: 'text/csv',
      purpose: 'CATALOG',
    });
    expect(preview.status).toBe(200);
    const mapping = preview.body.data.mapping as Record<string, string>;
    expect(mapping).toMatchObject({ name: 'Product Name', qty: 'Opening Qty', hsn: 'HSN' });

    const confirm = await authPost(invToken, '/api/inventory/ai/import/confirm', {
      mode: 'CATALOG',
      mapping,
      rows: preview.body.data.sampleRows,
    });
    expect(confirm.status).toBe(201);
    expect(confirm.body.data.mode).toBe('CATALOG');
    expect(confirm.body.data.created).toBeGreaterThanOrEqual(2);

    const created = await prisma.resource.findMany({
      where: { companyId, name: { in: ['AI Cement', 'AI Steel'] } },
      select: { name: true, hsnSacCode: true, rate: true },
    });
    expect(created.map((r) => r.name).sort()).toEqual(['AI Cement', 'AI Steel']);
    expect(created[0]!.hsnSacCode).toBe('2523');
    expect(Number(created[0]!.rate)).toBe(350);
  });

  it('7.2 OPENING confirm reuses the Phase 1 import (sets opening stock for catalog items)', async () => {
    const confirm = await authPost(invToken, '/api/inventory/ai/import/confirm', {
      mode: 'OPENING',
      mapping: { name: 'Product Name', qty: 'Opening Qty', rate: 'Rate' },
      rows: [
        { 'Product Name': 'AI Cement', 'Opening Qty': '40', Rate: '350' },
        { 'Product Name': 'AI Steel', 'Opening Qty': '25', Rate: '88' },
      ],
    });
    expect(confirm.status).toBe(201);
    expect(confirm.body.data.applied).toBe(2);

    const balances = await prisma.stockBalance.findMany({
      where: {
        location: { companyId, projectId: defaultProjectId },
        resource: { companyId, name: { in: ['AI Cement', 'AI Steel'] } },
      },
      select: { quantity: true, resource: { select: { name: true } } },
    });
    expect(balances.map((b) => Number(b.quantity)).sort()).toEqual([25, 40]);
  });

  it('7.3 anomaly hints flag a PO rate far above WAC/last buy', async () => {
    const itemRes = await authPost(invToken, '/api/resources', {
      name: `Anomaly Item ${suffix}`,
      type: 'MATERIAL',
      unit: 'bag',
      rate: 150,
      gstRate: 18,
    });
    const itemId = itemRes.body.data.id as string;

    // Establish WAC 100 via GRN (non-today receivedDate keeps dashboard stable).
    const req1 = await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/requisitions`, {
      lines: [{ resourceId: itemId, quantity: 10, unit: 'bag' }],
    });
    expect(req1.status).toBe(201);
    const po1 = await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/purchase-orders`, {
      poNumber: `PO-AN-${suffix}`,
      vendorName: 'Anomaly Vendor',
      requisitionId: req1.body.data.id as string,
      lines: [{ resourceId: itemId, quantity: 10, unit: 'bag', rate: 100 }],
    });
    expect(po1.status).toBe(201);
    const grn1 = await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/grn`, {
      grnNumber: `GRN-AN-${suffix}`,
      purchaseOrderId: po1.body.data.id as string,
      receivedDate: '2026-08-10',
      lines: [{ resourceId: itemId, quantity: 10, unit: 'bag' }],
    });
    expect(grn1.status).toBe(201);

    // PO at 300 (200% above WAC 100) - must be flagged.
    const req2 = await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/requisitions`, {
      lines: [{ resourceId: itemId, quantity: 5, unit: 'bag' }],
    });
    expect(req2.status).toBe(201);
    const po2 = await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/purchase-orders`, {
      poNumber: `PO-AN2-${suffix}`,
      vendorName: 'Anomaly Vendor',
      requisitionId: req2.body.data.id as string,
      lines: [{ resourceId: itemId, quantity: 5, unit: 'bag', rate: 300 }],
    });
    expect(po2.status).toBe(201);

    const hintsRes = await authGet(invToken, '/api/inventory/ai/anomalies');
    expect(hintsRes.status).toBe(200);
    const hints = hintsRes.body.data as Array<{
      type: string;
      title: string;
      detail: string;
      severity: string;
      referenceId?: string;
    }>;
    const rateHint = hints.find((h) => h.type === 'PO_RATE' && h.referenceId === po2.body.data.id);
    expect(rateHint).toBeTruthy();
    expect(rateHint!.title).toContain('PO-AN2');
    expect(rateHint!.detail).toContain('200%');
    expect(rateHint!.severity).toBe('high');
  });

  it('7.4 inventory assistant tools answer from analytics/reorder data; construction is denied', async () => {
    // Inventory OWNER can read low stock + stock health.
    const invIdentity = await resolveAssistantIdentity(companyId, invUserId);
    const lowStock = await executeAssistantTool(invIdentity, 'get_low_stock', {});
    expect(Array.isArray(lowStock)).toBe(true);
    const health = await executeAssistantTool(invIdentity, 'get_stock_health', {});
    expect(Array.isArray(health)).toBe(true);

    // Construction tenant (even OWNER) is denied inventory-only tools.
    const constToken = await loginAs(CONSTRUCTION_OWNER);
    const me = await authGet(constToken, '/api/auth/me');
    const constIdentity = await resolveAssistantIdentity(me.body.data.companyId, me.body.data.id);
    expect(constIdentity.productMode).toBe('construction');
    await expect(
      executeAssistantTool(constIdentity, 'get_low_stock', {}),
    ).rejects.toThrow(/not allowed/i);
    await expect(
      executeAssistantTool(constIdentity, 'get_stock_health', {}),
    ).rejects.toThrow(/not allowed/i);
  });

  it('construction tenants get 403 on all Phase 7 AI routes', async () => {
    const constToken = await loginAs(CONSTRUCTION_OWNER);
    const posts = [
      '/api/inventory/ai/bills/extract',
      '/api/inventory/ai/bills/create-from-draft',
      '/api/inventory/ai/import/preview',
      '/api/inventory/ai/import/confirm',
    ];
    for (const p of posts) {
      expect((await authPost(constToken, p, {})).status).toBe(403);
    }
    expect((await authGet(constToken, '/api/inventory/ai/anomalies')).status).toBe(403);
  });

  /* ── Phase 8: scan ops & commercial polish ────────────────────────── */

  it('8.3 GRN with batchCode → IN movement; issue same batch → OUT movement recorded', async () => {
    const itemRes = await authPost(invToken, '/api/resources', {
      name: `Batch Item ${suffix}`,
      type: 'MATERIAL',
      unit: 'bag',
      rate: 100,
      gstRate: 18,
    });
    expect(itemRes.status).toBe(201);
    const itemId = itemRes.body.data.id as string;

    const req = await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/requisitions`, {
      lines: [{ resourceId: itemId, quantity: 10, unit: 'bag' }],
    });
    expect(req.status).toBe(201);
    const po = await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/purchase-orders`, {
      poNumber: `PO-BATCH-${suffix}`,
      vendorName: 'Batch Vendor',
      requisitionId: req.body.data.id as string,
      lines: [{ resourceId: itemId, quantity: 10, unit: 'bag', rate: 100 }],
    });
    expect(po.status).toBe(201);
    const grn = await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/grn`, {
      grnNumber: `GRN-BATCH-${suffix}`,
      purchaseOrderId: po.body.data.id as string,
      receivedDate: '2026-08-12',
      lines: [{ resourceId: itemId, quantity: 10, unit: 'bag', batchCode: 'LOT-2026-A' }],
    });
    expect(grn.status).toBe(201);

    const grnMovement = await prisma.stockMovement.findFirst({
      where: { resourceId: itemId, type: 'IN', referenceType: 'GRN' },
      orderBy: { createdAt: 'desc' },
    });
    expect(grnMovement?.batchCode).toBe('LOT-2026-A');

    const issue = await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/stock/issue`, {
      lines: [{ resourceId: itemId, quantity: 3, unit: 'bag', batchCode: 'LOT-2026-A' }],
    });
    expect(issue.status).toBe(201);

    const outMovement = await prisma.stockMovement.findFirst({
      where: { resourceId: itemId, type: 'OUT', referenceType: 'MANUAL_ISSUE' },
      orderBy: { createdAt: 'desc' },
    });
    expect(outMovement?.batchCode).toBe('LOT-2026-A');

    // Movement history API exposes the batch code.
    const movementsRes = await authGet(
      invToken,
      `/api/projects/${defaultProjectId}/procurement/stock/movements?resourceId=${itemId}`,
    );
    expect(movementsRes.status).toBe(200);
    const rows = movementsRes.body.data as Array<{ id: string; batchCode?: string | null }>;
    expect(rows.some((r) => r.batchCode === 'LOT-2026-A')).toBe(true);
  });

  it('8.4 margin uses billed invoice-line amount when the line is resource-linked', async () => {
    const itemRes = await authPost(invToken, '/api/resources', {
      name: `MarginBilled Item ${suffix}`,
      type: 'MATERIAL',
      unit: 'bag',
      rate: 150, // catalog rate - must NOT drive revenue once linked
      gstRate: 18,
    });
    expect(itemRes.status).toBe(201);
    const itemId = itemRes.body.data.id as string;

    // WAC 100 via GRN.
    const req = await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/requisitions`, {
      lines: [{ resourceId: itemId, quantity: 10, unit: 'bag' }],
    });
    expect(req.status).toBe(201);
    const po = await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/purchase-orders`, {
      poNumber: `PO-MB-${suffix}`,
      vendorName: 'MB Vendor',
      requisitionId: req.body.data.id as string,
      lines: [{ resourceId: itemId, quantity: 10, unit: 'bag', rate: 100 }],
    });
    expect(po.status).toBe(201);
    const grn = await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/grn`, {
      grnNumber: `GRN-MB-${suffix}`,
      purchaseOrderId: po.body.data.id as string,
      receivedDate: '2026-08-12',
      lines: [{ resourceId: itemId, quantity: 10, unit: 'bag' }],
    });
    expect(grn.status).toBe(201);

    // Issue 5 @ billed rate 200 → draft invoice links the resource (amount 1000).
    const issueRes = await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/stock/issue`, {
      lines: [{ resourceId: itemId, quantity: 5, unit: 'bag', unitPrice: 200 }],
    });
    expect(issueRes.status).toBe(201);
    const movementIds = (issueRes.body.data.movementIds ?? []) as string[];

    // Draft invoice from issue already carries the resource link (8.4).
    const draftInvoice = await prisma.invoice.findFirst({
      where: { stockMovementId: { in: movementIds } },
      include: { lineItems: true },
    });
    const line = draftInvoice?.lineItems.find((li) => li.resourceId === itemId);
    expect(line).toBeTruthy();
    expect(Number(line?.amount)).toBeCloseTo(1000, 2);

    const margin = await authGet(invToken, '/api/inventory/analytics/reports/margin');
    expect(margin.status).toBe(200);
    const row = (margin.body.data as Array<{
      resourceId: string;
      revenue: number;
      cogs: number;
      margin: number;
      revenueSource: string;
    }>).find((r) => r.resourceId === itemId);
    expect(Number(row?.revenue)).toBeCloseTo(1000, 2); // billed, not 5 × catalog 150
    expect(row?.revenueSource).toBe('BILLED');
    expect(Number(row?.cogs)).toBeCloseTo(500, 2); // 5 × WAC 100
  });

  it('8.5 low-stock alert writes an in-app notification for the OWNER', async () => {
    const itemRes = await authPost(invToken, '/api/resources', {
      name: `Alert Item ${suffix}`,
      type: 'MATERIAL',
      unit: 'bag',
      rate: 50,
      gstRate: 18,
      reorderPoint: 10,
    });
    expect(itemRes.status).toBe(201);
    const itemId = itemRes.body.data.id as string;

    // Establish 4 on hand via opening stock import (below reorderPoint 10).
    const open = await authPost(invToken, '/api/inventory/stock/opening-stock', {
      lines: [{ resourceId: itemId, quantity: 4, rate: 50 }],
    });
    expect(open.status).toBe(201);

    await notifyLowStock(companyId, [
      { resourceId: itemId, name: `Alert Item ${suffix}`, unit: 'bag', onHand: 4, reorderPoint: 10 },
    ]);

    const n = await prisma.notification.findFirst({
      where: { userId: invUserId, type: 'INVENTORY_LOW_STOCK' },
      orderBy: { createdAt: 'desc' },
    });
    expect(n).toBeTruthy();
    expect(n!.title).toContain('Alert Item');
    expect(n!.body).toContain('4');
  });


  /* ── Phase 9: dealer GTM polish (price lists, quotes, PDFs, reminders) ── */

  it('9.1 customer price override wins over catalog rate on SO, Issue and Invoice', async () => {
    const custRes = await authPost(invToken, '/api/inventory/parties/customers', { name: `Priced Cust ${suffix}` });
    expect(custRes.status).toBe(201);
    const customerId = custRes.body.data.id as string;

    const itemRes = await authPost(invToken, '/api/resources', {
      name: `Priced Item ${suffix}`,
      type: 'MATERIAL',
      unit: 'bag',
      rate: 150, // catalog
      gstRate: 18,
    });
    expect(itemRes.status).toBe(201);
    const itemId = itemRes.body.data.id as string;

    // Set a ₹120 override for this customer.
    const priceRes = await authPost(invToken, '/api/inventory/price-list', {
      customerId,
      resourceId: itemId,
      rate: 120,
    });
    expect(priceRes.status).toBe(201);

    const listed = await authGet(invToken, `/api/inventory/price-list?customerId=${customerId}`);
    expect(listed.status).toBe(200);
    expect((listed.body.data as Array<{ resourceId: string; rate: number; scope: string }>)[0]).toMatchObject({
      resourceId: itemId,
      rate: 120,
      scope: 'CUSTOMER',
    });

    // SO with rate 0 → override 120 wins over catalog 150.
    const so = await authPost(invToken, '/api/inventory/transactions/sales-orders', {
      customerId,
      customerName: 'Priced Cust',
      orderDate: '2026-08-12',
      lines: [{ resourceId: itemId, quantity: 2, unit: 'bag', rate: 0 }],
    });
    expect(so.status).toBe(201);
    const soLine = (so.body.data.lines as Array<{ resourceId: string; rate: number }>).find((l) => l.resourceId === itemId);
    expect(Number(soLine?.rate)).toBe(120);

    // Issue for that customer without a unit price → draft invoice line = 120.
    const open = await authPost(invToken, '/api/inventory/stock/opening-stock', {
      lines: [{ resourceId: itemId, quantity: 10, rate: 100 }],
    });
    expect(open.status).toBe(201);
    const issue = await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/stock/issue`, {
      customerId,
      customerName: 'Priced Cust',
      lines: [{ resourceId: itemId, quantity: 3, unit: 'bag' }],
    });
    expect(issue.status).toBe(201);
    const movementIds = (issue.body.data.movementIds ?? []) as string[];
    const draftInvoice = await prisma.invoice.findFirst({
      where: { stockMovementId: { in: movementIds } },
      include: { lineItems: true },
    });
    const invLine = draftInvoice?.lineItems.find((li) => li.resourceId === itemId);
    expect(Number(invLine?.rate)).toBe(120);

    // Manual invoice with rate 0 + resource link → override 120.
    const manual = await authPost(invToken, `/api/projects/${defaultProjectId}/invoices`, {
      invoiceNumber: `PRINV-${suffix}`,
      projectId: defaultProjectId,
      customerId,
      clientName: 'Priced Cust',
      invoiceDate: '2026-08-12',
      dueDate: '2026-08-27',
      gstRate: 0,
      lineItems: [{ resourceId: itemId, description: 'Priced Item', quantity: 1, unit: 'bag', rate: 0, gstRate: 0 }],
    });
    expect(manual.status).toBe(201);
    const manualLine = (manual.body.data.lineItems as Array<{ resourceId: string; rate: number }>).find((l) => l.resourceId === itemId);
    expect(Number(manualLine?.rate)).toBe(120);
  });

  it('9.2 quote DRAFT → SENT → ACCEPTED → creates a Sales Order with copied lines', async () => {
    const itemRes = await authPost(invToken, '/api/resources', {
      name: `Quote Item ${suffix}`,
      type: 'MATERIAL',
      unit: 'bag',
      rate: 200,
      gstRate: 18,
    });
    expect(itemRes.status).toBe(201);
    const itemId = itemRes.body.data.id as string;

    const quote = await authPost(invToken, '/api/inventory/quotes', {
      customerName: 'Quote Cust',
      quoteDate: '2026-08-12',
      lines: [{ resourceId: itemId, quantity: 5, unit: 'bag', rate: 180, gstRate: 18 }],
    });
    expect(quote.status).toBe(201);
    const quoteId = quote.body.data.id as string;
    expect(quote.body.data.status).toBe('DRAFT');

    const sent = await authPost(invToken, `/api/inventory/quotes/${quoteId}/action`, { action: 'send' });
    expect(sent.status).toBe(200);
    expect(sent.body.data.status).toBe('SENT');
    const accepted = await authPost(invToken, `/api/inventory/quotes/${quoteId}/action`, { action: 'accept' });
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.status).toBe('ACCEPTED');

    const soRes = await authPost(invToken, `/api/inventory/quotes/${quoteId}/sales-order`);
    expect(soRes.status).toBe(201);
    const so = soRes.body.data.salesOrder as {
      id: string;
      customerName: string;
      lines: Array<{ resourceId: string; quantity: number; rate: number }>;
    };
    expect(so.customerName).toBe('Quote Cust');
    expect(so.lines).toHaveLength(1);
    expect(so.lines[0].resourceId).toBe(itemId);
    expect(Number(so.lines[0].quantity)).toBe(5);
    expect(Number(so.lines[0].rate)).toBe(180);

    // Already converted → rejected.
    const again = await authPost(invToken, `/api/inventory/quotes/${quoteId}/sales-order`);
    expect(again.status).toBe(400);
  });

  it('9.3 SO / DC / GRN PDFs download as application/pdf (inventory gated)', async () => {
    const itemRes = await authPost(invToken, '/api/resources', {
      name: `PDF Item ${suffix}`,
      type: 'MATERIAL',
      unit: 'bag',
      rate: 100,
      gstRate: 18,
    });
    expect(itemRes.status).toBe(201);
    const itemId = itemRes.body.data.id as string;

    // SO PDF
    const so = await authPost(invToken, '/api/inventory/transactions/sales-orders', {
      customerName: 'PDF Cust',
      orderDate: '2026-08-12',
      lines: [{ resourceId: itemId, quantity: 2, unit: 'bag', rate: 100 }],
    });
    expect(so.status).toBe(201);
    const soPdf = await authGet(invToken, `/api/inventory/pdf/sales-orders/${so.body.data.id}`);
    expect(soPdf.status).toBe(200);
    expect(String(soPdf.headers['content-type'])).toContain('application/pdf');

    // GRN PDF
    const req = await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/requisitions`, {
      lines: [{ resourceId: itemId, quantity: 10, unit: 'bag' }],
    });
    expect(req.status).toBe(201);
    const po = await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/purchase-orders`, {
      poNumber: `PO-PDF-${suffix}`,
      vendorName: 'PDF Vendor',
      requisitionId: req.body.data.id as string,
      lines: [{ resourceId: itemId, quantity: 10, unit: 'bag', rate: 100 }],
    });
    expect(po.status).toBe(201);
    const grn = await authPost(invToken, `/api/projects/${defaultProjectId}/procurement/grn`, {
      grnNumber: `GRN-PDF-${suffix}`,
      purchaseOrderId: po.body.data.id as string,
      receivedDate: '2026-08-12',
      lines: [{ resourceId: itemId, quantity: 10, unit: 'bag' }],
    });
    expect(grn.status).toBe(201);
    const grnPdf = await authGet(invToken, `/api/inventory/pdf/grn/${grn.body.data.id}`);
    expect(grnPdf.status).toBe(200);
    expect(String(grnPdf.headers['content-type'])).toContain('application/pdf');

    // DC PDF (SO → confirm → DC → dispatch)
    const so2 = await authPost(invToken, '/api/inventory/transactions/sales-orders', {
      customerName: 'PDF Cust 2',
      orderDate: '2026-08-12',
      lines: [{ resourceId: itemId, quantity: 2, unit: 'bag', rate: 100 }],
    });
    expect(so2.status).toBe(201);
    const soAction = await authPost(invToken, `/api/inventory/transactions/sales-orders/${so2.body.data.id}/action`, { action: 'confirm' });
    expect(soAction.status).toBe(200);
    const dc = await authPost(invToken, '/api/inventory/transactions/delivery-challans', { salesOrderId: so2.body.data.id });
    expect(dc.status).toBe(201);
    const dispatch = await authPost(invToken, `/api/inventory/transactions/delivery-challans/${dc.body.data.id}/dispatch`, {});
    expect(dispatch.status).toBe(200);
    const dcPdf = await authGet(invToken, `/api/inventory/pdf/delivery-challans/${dc.body.data.id}`);
    expect(dcPdf.status).toBe(200);
    expect(String(dcPdf.headers['content-type'])).toContain('application/pdf');
  });

  it('9.4 overdue invoice reminder notifies OWNER + manual Remind endpoint works', async () => {
    const cust = await authPost(invToken, '/api/inventory/parties/customers', { name: `Remind Cust ${suffix}` });
    expect(cust.status).toBe(201);
    const invoiceRes = await authPost(invToken, `/api/projects/${defaultProjectId}/invoices`, {
      invoiceNumber: `RMINV-${suffix}`,
      projectId: defaultProjectId,
      customerId: cust.body.data.id as string,
      clientName: 'Remind Cust',
      invoiceDate: '2026-07-01',
      dueDate: '2026-07-15',
      gstRate: 0,
      lineItems: [{ description: 'Item', quantity: 1, unit: 'bag', rate: 500, gstRate: 0 }],
    });
    expect(invoiceRes.status).toBe(201);
    const invoiceId = invoiceRes.body.data.id as string;
    expect((await authPost(invToken, `/api/invoices/${invoiceId}/send`)).status).toBe(200);

    const remind = await authPost(invToken, `/api/inventory/invoices/${invoiceId}/remind`);
    expect(remind.status).toBe(200);
    expect(remind.body.data.reminded).toBe(true);

    const n = await prisma.notification.findFirst({
      where: { userId: invUserId, type: 'INVENTORY_OVERDUE_INVOICE', referenceId: invoiceId },
      orderBy: { createdAt: 'desc' },
    });
    expect(n).toBeTruthy();
    expect(n!.title).toContain('payment reminder');
  });

  it('9.5 AI create-from-draft persists matched resource ids in the bill snapshot', async () => {
    const itemRes = await authPost(invToken, '/api/resources', {
      name: `AIRes Item ${suffix}`,
      type: 'MATERIAL',
      unit: 'bag',
      rate: 90,
      gstRate: 18,
    });
    expect(itemRes.status).toBe(201);
    const itemId = itemRes.body.data.id as string;

    const billNumber = `AI9BILL-${suffix}`;
    const res = await authPost(invToken, '/api/inventory/ai/bills/create-from-draft', {
      draft: {
        vendorName: 'AI9 Vendor',
        billNumber,
        billDate: '2026-08-12',
        subtotal: 900,
        gstAmount: 162,
        tdsAmount: 0,
        total: 1062,
        category: 'MATERIAL',
        confidence: 0.9,
        lines: [
          {
            description: 'AIRes Item',
            unit: 'bag',
            quantity: 10,
            rate: 90,
            gstRate: 18,
            amount: 900,
            matchedResourceId: itemId,
          },
        ],
      },
    });
    expect(res.status).toBe(201);
    const saved = await prisma.bill.findUniqueOrThrow({
      where: { companyId_billNumber: { companyId, billNumber } },
    });
    const snapshot = saved.billSnapshot as {
      lines: Array<{ description: string; matchedResourceId: string | null }>;
    };
    expect(snapshot.lines[0]!.matchedResourceId).toBe(itemId);
  });

  it('construction tenants get 403 on Phase 9 GTM routes', async () => {
    const constToken = await loginAs(CONSTRUCTION_OWNER);
    expect((await authGet(constToken, '/api/inventory/price-list')).status).toBe(403);
    expect((await authPost(constToken, '/api/inventory/price-list', {})).status).toBe(403);
    expect((await authGet(constToken, '/api/inventory/quotes')).status).toBe(403);
    expect((await authPost(constToken, '/api/inventory/quotes', {})).status).toBe(403);
    expect(
      (await authPost(constToken, '/api/inventory/invoices/00000000-0000-4000-8000-000000000000/remind')).status,
    ).toBe(403);
    expect(
      (await authGet(constToken, '/api/inventory/pdf/sales-orders/00000000-0000-4000-8000-000000000000')).status,
    ).toBe(403);
    expect((await authGet(constToken, '/api/inventory/pdf/grn/00000000-0000-4000-8000-000000000000')).status).toBe(403);
  });

  /* ────────────────────────────────────────────────────────────────────────
   * INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.1) - Kirana vertical catalog
   * K1 vertical (not a profile) · K2 RETAIL/WHOLESALE gate · K3 insert-missing
   * · K4 no price/qty/barcode seeding · OWNER-only · search by key/sku/barcode
   * ──────────────────────────────────────────────────────────────────────── */
  describe('KIRANA_VERTICAL (Phase 11.1) - starter catalog', () => {
    let kiranaTotalItems = 0;

    it('RETAIL/WHOLESALE without the KIRANA vertical: preview ineligible (200) + apply 422s (K2)', async () => {
      // K2 (11.1.5b): the VERTICAL (not the profile) gates the pack. Pin RETAIL
      // and clear any stale vertical so this is exactly "retail, no vertical" -
      // a hardware retail shop must NOT get the grocery pack.
      const pin = await authPut(invToken, '/api/settings/company', { inventoryProfile: 'RETAIL' });
      expect(pin.status).toBe(200);
      const clear = await authPut(invToken, '/api/inventory/catalog/vertical', { vertical: null });
      expect(clear.status).toBe(200);

      const prev = await authGet(invToken, '/api/inventory/catalog/preview?template=KIRANA');
      expect(prev.status).toBe(200);
      expect(prev.body.data.eligible).toBe(false);
      expect(prev.body.data.ineligibilityReason).toMatch(/vertical/i);
      expect(prev.body.data.totalItems).toBeGreaterThanOrEqual(100);
      expect(prev.body.data.categories.length).toBeGreaterThanOrEqual(6);

      const apply = await authPost(invToken, '/api/inventory/catalog/apply', { template: 'KIRANA' });
      expect(apply.status).toBe(422);
      expect(apply.body.error?.message ?? apply.body.message).toMatch(/vertical/i);
    });

    it('OWNER opts into the KIRANA vertical (RETAIL), previews, applies, stamps vertical', async () => {
      const setV = await authPut(invToken, '/api/inventory/catalog/vertical', { vertical: 'KIRANA' });
      expect(setV.status).toBe(200);
      expect(setV.body.data.inventoryVertical).toBe('KIRANA');

      const prev = await authGet(invToken, '/api/inventory/catalog/preview?template=KIRANA');
      expect(prev.status).toBe(200);
      expect(prev.body.data.eligible).toBe(true);
      expect(prev.body.data.alreadyApplied).toBe(0);
      const totalItems = prev.body.data.totalItems as number;
      kiranaTotalItems = totalItems;
      expect(totalItems).toBeGreaterThanOrEqual(100);

      const apply = await authPost(invToken, '/api/inventory/catalog/apply', { template: 'KIRANA' });
      expect(apply.status).toBe(200);
      expect(apply.body.data.created).toBe(totalItems);
      expect(apply.body.data.skipped).toBe(0);
      expect(apply.body.data.inventoryVertical).toBe('KIRANA');
      expect(apply.body.data.catalogSeededAt).toBeTruthy();

      const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
      expect(company.inventoryVertical).toBe('KIRANA');
      expect(company.catalogSeededAt).toBeTruthy();

      // K4: templated rows carry itemCode but NO price / barcode.
      const seeded = await prisma.resource.findFirstOrThrow({
        where: { companyId, itemCode: 'KIR-001' },
      });
      expect(seeded.name).toBe('Wheat Atta 5 kg');
      expect(Number(seeded.rate)).toBe(0);
      expect(seeded.barcode).toBeNull();
      expect(seeded.type).toBe('MATERIAL');

      // Settings payload surfaces the vertical (inventory-only).
      const settings = await authGet(invToken, '/api/settings/company');
      expect(settings.body.data.inventoryVertical).toBe('KIRANA');
      expect(settings.body.data.catalogSeededAt).toBeTruthy();
    });

    it('re-apply is insert-missing: 0 created, all skipped, tenant edits preserved (K3)', async () => {
      const seeded = await prisma.resource.findFirstOrThrow({
        where: { companyId, itemCode: 'KIR-001' },
      });
      await prisma.resource.update({
        where: { id: seeded.id },
        data: { rate: 45.5, gstRate: 12, category: 'Racks - Staples' },
      });

      const apply = await authPost(invToken, '/api/inventory/catalog/apply', { template: 'KIRANA' });
      expect(apply.status).toBe(200);
      expect(apply.body.data.created).toBe(0);
      expect(apply.body.data.restored).toBe(0);
      expect(apply.body.data.skipped).toBe(kiranaTotalItems);

      const after = await prisma.resource.findFirstOrThrow({ where: { id: seeded.id } });
      expect(Number(after.rate)).toBe(45.5); // price preserved
      expect(Number(after.gstRate)).toBe(12); // GST edit preserved
      expect(after.category).toBe('Racks - Staples'); // category edit preserved
    });

    it('deleted template rows are restored by the next apply (insert-missing semantics)', async () => {
      const target = await prisma.resource.findFirstOrThrow({
        where: { companyId, itemCode: 'KIR-050' },
      });
      await prisma.resource.update({ where: { id: target.id }, data: { isDeleted: true } });

      const apply = await authPost(invToken, '/api/inventory/catalog/apply', { template: 'KIRANA' });
      expect(apply.status).toBe(200);
      // Soft-deleted template rows are RESTORED (Resource unique companyId/name/type
      // prevents re-inserting a duplicate), so created stays 0 and restored is 1.
      expect(apply.body.data.created).toBe(0);
      expect(apply.body.data.restored).toBe(1);

      const re = await prisma.resource.findFirstOrThrow({
        where: { companyId, itemCode: 'KIR-050', isDeleted: false },
      });
      expect(re.name).toBe(target.name); // restored, not duplicated
    });

    it('listResources search matches itemCode, sku and barcode (11.1.6)', async () => {
      const seeded = await prisma.resource.findFirstOrThrow({
        where: { companyId, itemCode: 'KIR-001' },
      });
      await prisma.resource.update({
        where: { id: seeded.id },
        data: { sku: 'KIR-001-SKU', barcode: '8901234500001' },
      });

      const byKey = await authGet(invToken, '/api/resources?search=KIR-001&limit=10');
      expect(byKey.status).toBe(200);
      expect(byKey.body.data.map((r: { name: string }) => r.name)).toContain('Wheat Atta 5 kg');

      const bySku = await authGet(invToken, '/api/resources?search=KIR-001-SKU&limit=10');
      expect(bySku.body.data.map((r: { name: string }) => r.name)).toContain('Wheat Atta 5 kg');

      const byBarcode = await authGet(invToken, '/api/resources?search=8901234500001&limit=10');
      expect(byBarcode.body.data.map((r: { name: string }) => r.name)).toContain('Wheat Atta 5 kg');
    });

    it('vertical picker: retail shop types save without catalogs; supplier + manager cannot', async () => {
      // WHOLESALE is just as eligible as RETAIL to opt into the vertical.
      const toWs = await authPut(invToken, '/api/settings/company', { inventoryProfile: 'WHOLESALE' });
      expect(toWs.status).toBe(200);
      const wsSet = await authPut(invToken, '/api/inventory/catalog/vertical', { vertical: 'KIRANA' });
      expect(wsSet.status).toBe(200);
      expect(wsSet.body.data.inventoryVertical).toBe('KIRANA');
      // Back to RETAIL so the later apply assertions keep exercising RETAIL.
      const back = await authPut(invToken, '/api/settings/company', { inventoryProfile: 'RETAIL' });
      expect(back.status).toBe(200);

      // These verticals classify the shop only. They do not expose a catalog
      // template until a maintained pack is added for that vertical.
      for (const vertical of ['PHARMACY', 'ELECTRONICS', 'STATIONERY', 'HARDWARE']) {
        const set = await authPut(invToken, '/api/inventory/catalog/vertical', { vertical });
        expect(set.status).toBe(200);
        expect(set.body.data.inventoryVertical).toBe(vertical);
      }
      const noHardwarePack = await authPost(invToken, '/api/inventory/catalog/apply', {
        template: 'HARDWARE',
      });
      expect(noHardwarePack.status).toBe(422);

      // Restore Kirana for the batch/expiry tests that follow this section.
      const restore = await authPut(invToken, '/api/inventory/catalog/vertical', { vertical: 'KIRANA' });
      expect(restore.status).toBe(200);

      // Manager (non-OWNER) is denied the vertical picker.
      const managerToken = await loginAs('manager@hydmaterials.com');
      expect(
        (await authPut(managerToken, '/api/inventory/catalog/vertical', { vertical: 'KIRANA' })).status,
      ).toBe(403);

      // Real MATERIAL_SUPPLIER tenant cannot opt into KIRANA (profile gate, K2).
      const supplierToken = await loginAs('owner@hydmaterials.com');
      const supplierSet = await authPut(supplierToken, '/api/inventory/catalog/vertical', {
        vertical: 'KIRANA',
      });
      expect(supplierSet.status).toBe(422);
      expect(supplierSet.body.error?.message ?? supplierSet.body.message).toMatch(/RETAIL \/ WHOLESALE/i);

      // And the supplier can never apply the pack (vertical gate).
      const supplierApply = await authPost(supplierToken, '/api/inventory/catalog/apply', {
        template: 'KIRANA',
      });
      expect(supplierApply.status).toBe(422);
      expect(supplierApply.body.error?.message ?? supplierApply.body.message).toMatch(/vertical/i);
    });

    it('non-OWNER roles cannot preview/apply (403)', async () => {
      const managerToken = await loginAs('manager@hydmaterials.com');
      expect(
        (await authGet(managerToken, '/api/inventory/catalog/preview?template=KIRANA')).status,
      ).toBe(403);
      expect(
        (await authPost(managerToken, '/api/inventory/catalog/apply', { template: 'KIRANA' })).status,
      ).toBe(403);
    });

    it('construction tenants are feature-gated out of the catalog routes (403)', async () => {
      const constToken = await loginAs(CONSTRUCTION_OWNER);
      expect(
        (await authGet(constToken, '/api/inventory/catalog/preview?template=KIRANA')).status,
      ).toBe(403);
      expect(
        (await authPost(constToken, '/api/inventory/catalog/apply', { template: 'KIRANA' })).status,
      ).toBe(403);
      expect(
        (await authPut(constToken, '/api/inventory/catalog/vertical', { vertical: 'KIRANA' })).status,
      ).toBe(403);
    });
  });

});

