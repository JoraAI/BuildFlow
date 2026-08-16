/**
 * INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.2) - batch / expiry / FEFO.
 *
 * Registers a fresh INVENTORY tenant, opts into the KIRANA vertical, applies the
 * starter catalog, flags a few perishable items BATCH_EXPIRY, then drives:
 *   - GRN with batch + expiry → lot rows + aggregate both increase (K6 dual-write)
 *   - multi-lot FEFO issue → earliest expiry allocated first, one OUT movement per lot
 *   - expired-only stock → blocked without allowExpired, allowed with override
 *   - transfer → lot qty moves with the batch (dispatch → receive)
 *   - sales return GOOD → restores the known lot sold
 *   - read surfaces (batches / expiry-summary) are Kirana-vertical-only (403 for
 *     a non-Kirana RETAIL tenant); trackingMode BATCH_EXPIRY is rejected there
 *   - construction GRN needs NO batch/expiry (regression)
 */
import request from 'supertest';
import { app } from '../../app';
import { prisma } from '../../lib/prisma';
import { loginAs, authGet, authPost, authPut, getProjectId } from './test-helpers';

const PASSWORD = 'Test@1234';
const CONSTRUCTION_OWNER = 'owner@reddyconst.com';

function uniqueGstin(): string {
  const n = Date.now().toString().slice(-6);
  return `36AABCR${n.slice(0, 4)}A1Z5`;
}

async function registerInventoryCompany(suffix: string) {
  const res = await request(app).post('/api/auth/register').send({
    companyName: `Test Kirana Co ${suffix}`,
    gstin: uniqueGstin(),
    pan: `AABCR${suffix.slice(-4).toUpperCase()}A`,
    state: 'Telangana',
    ownerName: 'Kirana Owner',
    ownerEmail: `kirana-owner-${suffix}@example.com`,
    password: PASSWORD,
    product: 'inventory',
  });
  return res;
}

describe('KIRANA_BATCH_EXPIRY (Phase 11.2) - batch / expiry / FEFO', () => {
  let invToken: string;
  let companyId: string;
  let projectId: string;
  let milkId: string; // KIR-035 Milk Pouch - BATCH_EXPIRY
  let curdId: string; // KIR-036 Curd - BATCH_EXPIRY
  const suffix = Date.now().toString();

  beforeAll(async () => {
    const res = await registerInventoryCompany(suffix);
    if (res.status !== 201) {
      throw new Error(`Kirana register failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    invToken = res.body.data.accessToken as string;
    companyId = res.body.data.user.companyId as string;
    projectId = res.body.data.user.defaultProjectId as string;

    // Opt into the KIRANA vertical (RETAIL profile first) and apply the pack.
    const profile = await authPut(invToken, '/api/settings/company', { inventoryProfile: 'RETAIL' });
    expect(profile.status).toBe(200);
    const vert = await authPut(invToken, '/api/inventory/catalog/vertical', { vertical: 'KIRANA' });
    expect(vert.status).toBe(200);
    const apply = await authPost(invToken, '/api/inventory/catalog/apply', { template: 'KIRANA' });
    expect(apply.status).toBe(200);
    expect(apply.body.data.created).toBeGreaterThanOrEqual(100);

    // Flag the perishable demo items as BATCH_EXPIRY (Kirana-only guard passes).
    const milk = await prisma.resource.findFirstOrThrow({ where: { companyId, itemCode: 'KIR-035' } });
    const curd = await prisma.resource.findFirstOrThrow({ where: { companyId, itemCode: 'KIR-036' } });
    milkId = milk.id;
    curdId = curd.id;
    const milkUpd = await authPut(invToken, `/api/resources/${milk.id}`, { trackingMode: 'BATCH_EXPIRY' });
    expect(milkUpd.status).toBe(200);
    expect(milkUpd.body.data.trackingMode).toBe('BATCH_EXPIRY');
    const curdUpd = await authPut(invToken, `/api/resources/${curd.id}`, { trackingMode: 'BATCH_EXPIRY' });
    expect(curdUpd.status).toBe(200);

    // Stock flows lazily create the default location; pre-create it so the
    // tests can resolve it up front and every flow reuses the same one.
    const project = await prisma.project.findFirstOrThrow({ where: { companyId } });
    await prisma.stockLocation.create({
      data: { companyId, projectId: project.id, name: 'Main Store', isDefault: true },
    });
  });

  afterAll(async () => {
    if (companyId) {
      await prisma.materialPriceHistory.deleteMany({ where: { companyId } });
      await prisma.transferOrder.deleteMany({ where: { companyId } });
      await prisma.stockCount.deleteMany({ where: { companyId } });
      await prisma.stockBatchBalance.deleteMany({ where: { location: { companyId } } });
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

  async function defaultLocationId(): Promise<string> {
    const loc = await prisma.stockLocation.findFirstOrThrow({ where: { companyId, isDefault: true } });
    return loc.id;
  }

  /** req → PO → (approve if needed) → GRN lines. */
  async function receiveWithPo(resourceId: string, qty: number, grnLines: Array<Record<string, unknown>>) {
    const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const reqRes = await authPost(invToken, `/api/projects/${projectId}/procurement/requisitions`, {
      reqNumber: `IND-${tag}`,
      lines: [{ resourceId, quantity: qty, unit: 'pouch' }],
    });
    expect(reqRes.status).toBe(201);
    const poRes = await authPost(invToken, `/api/projects/${projectId}/procurement/purchase-orders`, {
      poNumber: `PO-${tag}`,
      vendorName: 'Kirana Vendor',
      requisitionId: reqRes.body.data.id as string,
      lines: [{ resourceId, quantity: qty, unit: 'pouch', rate: 30 }],
    });
    expect(poRes.status).toBe(201);
    const poId = poRes.body.data.id as string;
    if (poRes.body.data.status !== 'APPROVED') {
      const appr = await authPost(
        invToken,
        `/api/projects/${projectId}/procurement/purchase-orders/${poId}/approve`,
      );
      expect(appr.status).toBe(200);
    }
    for (const [i, line] of grnLines.entries()) {
      const grn = await authPost(invToken, `/api/projects/${projectId}/procurement/grn`, {
        grnNumber: `GRN-${tag}-${i + 1}`,
        purchaseOrderId: poId,
        receivedDate: new Date().toISOString().slice(0, 10),
        lines: [{ resourceId, quantity: Number(line.quantity), unit: 'pouch', ...line }],
      });
      expect(grn.status).toBe(201);
    }
    return poId;
  }

  it('adds an item master without stock, then quick vendor receipt creates quantity and expiry batch', async () => {
    const addItem = await authPost(invToken, '/api/inventory/catalog/import-items', {
      items: [{ templateKey: 'KIR-050', mrp: 20, rate: 19 }],
    });
    expect(addItem.status).toBe(200);
    const resourceId = addItem.body.data.imported[0].resourceId as string;
    const before = await prisma.stockBalance.findFirst({ where: { resourceId } });
    expect(before).toBeNull();

    const expiry = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
    const receipt = await authPost(invToken, '/api/inventory/stock/quick-receipt', {
      vendorName: 'Neighbourhood Distributor',
      invoiceNumber: 'QVR-TEST-1',
      receivedDate: new Date().toISOString().slice(0, 10),
      lines: [{
        resourceId,
        quantity: 4,
        unitCost: 12,
        batchCode: 'CHIPS-QVR-1',
        expiresAt: expiry,
      }],
    });
    expect(receipt.status).toBe(201);
    const [resource, balance, batch, movement] = await Promise.all([
      prisma.resource.findUniqueOrThrow({ where: { id: resourceId } }),
      prisma.stockBalance.findFirstOrThrow({ where: { resourceId } }),
      prisma.stockBatchBalance.findFirstOrThrow({ where: { resourceId, batchCode: 'CHIPS-QVR-1' } }),
      prisma.stockMovement.findFirstOrThrow({
        where: { resourceId, referenceType: 'QUICK_VENDOR_RECEIPT' },
      }),
    ]);
    expect(resource.hsnSacCode).toBe('2106');
    expect(Number(resource.avgCost)).toBe(12);
    expect(Number(balance.quantity)).toBe(4);
    expect(batch.expiresAt).not.toBeNull();
    expect(Number(movement.inventoryValue)).toBe(48);
  });

  it('selective SKU intake stores editable MRP/rate and optional expiry in one stock operation', async () => {
    const library = await authGet(invToken, '/api/inventory/catalog/library?search=KIR-045&page=1&limit=10');
    expect(library.status).toBe(200);
    expect(library.body.data.items).toHaveLength(1);
    expect(library.body.data.items[0].suggestedMrp).toBeGreaterThan(0);

    const intake = await authPost(invToken, '/api/inventory/catalog/import-selected', {
      items: [{
        templateKey: 'KIR-045',
        mrp: 20,
        rate: 18,
        quantity: 3,
        batchCode: 'NOODLE-OPEN',
      }],
    });
    expect(intake.status).toBe(200);
    const resourceId = intake.body.data.imported[0].resourceId as string;
    const [resource, balance, batch] = await Promise.all([
      prisma.resource.findUniqueOrThrow({ where: { id: resourceId } }),
      prisma.stockBalance.findFirstOrThrow({ where: { resourceId } }),
      prisma.stockBatchBalance.findFirstOrThrow({ where: { resourceId, batchCode: 'NOODLE-OPEN' } }),
    ]);
    expect(Number(resource.mrp)).toBe(20);
    expect(Number(resource.rate)).toBe(18);
    expect(resource.trackingMode).toBe('BATCH_EXPIRY');
    expect(Number(balance.quantity)).toBe(3);
    expect(batch.expiresAt).toBeNull();
  });

  it('creates a custom shop SKU and opening stock through the same intake', async () => {
    const sku = `LOCAL-${Date.now()}`;
    const intake = await authPost(invToken, '/api/inventory/catalog/import-selected', {
      items: [{
        custom: {
          name: `Local Pickle ${sku}`,
          sku,
          unit: 'jar',
          category: 'Pickles',
          gstRate: 12,
        },
        mrp: 120,
        rate: 110,
        quantity: 6,
      }],
    });
    expect(intake.status).toBe(200);
    const resource = await prisma.resource.findFirstOrThrow({ where: { companyId, sku } });
    expect(resource.itemCode).toBeNull();
    expect(Number(resource.mrp)).toBe(120);
    expect(Number((await prisma.stockBalance.findFirstOrThrow({ where: { resourceId: resource.id } })).quantity)).toBe(6);
  });

  it('later batch date correction is audited and cannot change quantity', async () => {
    const batch = await prisma.stockBatchBalance.findFirstOrThrow({
      where: { resource: { companyId }, batchCode: 'NOODLE-OPEN' },
    });
    const exp = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10);
    const update = await request(app)
      .patch(`/api/inventory/stock/batches/${batch.id}`)
      .set('Authorization', `Bearer ${invToken}`)
      .send({ expiresAt: exp });
    expect(update.status).toBe(200);
    expect(update.body.data.expiresAt).not.toBeNull();
    expect(Number(update.body.data.quantity)).toBe(3);
    const audit = await prisma.auditLog.findFirst({
      where: { companyId, entityType: 'stock_batch_metadata', entityId: batch.id },
    });
    expect(audit).not.toBeNull();
  });


  it('GRN with batch + expiry writes lot rows AND increments the aggregate (K6 dual-write)', async () => {
    const locationId = await defaultLocationId();
    const exp = new Date(Date.now() + 45 * 86_400_000).toISOString().slice(0, 10);
    const mfg = new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10);
    await receiveWithPo(curdId, 10, [
      { quantity: 10, batchCode: 'CURD-LOT-1', manufacturedAt: mfg, expiresAt: exp },
    ]);

    const batch = await prisma.stockBatchBalance.findFirstOrThrow({
      where: { locationId, resourceId: curdId, batchCode: 'CURD-LOT-1' },
    });
    expect(Number(batch.quantity)).toBe(10);
    expect(batch.expiresAt).not.toBeNull();

    const balance = await prisma.stockBalance.findFirstOrThrow({ where: { locationId, resourceId: curdId } });
    expect(Number(balance.quantity)).toBeCloseTo(10, 3);
    // receipt line audit dates
    const grnLine = await prisma.goodsReceiptLine.findFirstOrThrow({
      where: { resourceId: curdId, batchCode: 'CURD-LOT-1' },
    });
    expect(grnLine.expiresAt).not.toBeNull();
  });

  it('FEFO: issue spanning 2 lots allocates earliest expiry first with one OUT movement per lot', async () => {
    const locationId = await defaultLocationId();
    const far = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
    const near = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
    // Two lots of Milk: MILK-FAR expires +60d, MILK-NEAR expires +20d.
    await receiveWithPo(milkId, 20, [
      { quantity: 10, batchCode: 'MILK-FAR', expiresAt: far },
      { quantity: 10, batchCode: 'MILK-NEAR', expiresAt: near },
    ]);

    const issue = await authPost(invToken, `/api/projects/${projectId}/procurement/stock/issue`, {
      lines: [{ resourceId: milkId, quantity: 12, unitPrice: 30 }],
    });
    expect(issue.status).toBe(201);

    const out = await prisma.stockMovement.findMany({
      where: { resourceId: milkId, type: 'OUT', referenceType: 'MANUAL_ISSUE' },
      orderBy: { createdAt: 'desc' },
      take: 2,
    });
    expect(out).toHaveLength(2);
    expect(out.map((m) => m.batchCode).sort()).toEqual(['MILK-FAR', 'MILK-NEAR']);
    // FEFO: the lot with the NEAREST expiry (MILK-NEAR) is drained first.
    const nearOut = out.find((m) => m.batchCode === 'MILK-NEAR');
    const farOut = out.find((m) => m.batchCode === 'MILK-FAR');
    expect(Number(nearOut!.quantity)).toBe(10);
    expect(Number(farOut!.quantity)).toBe(2);

    const lotNear = await prisma.stockBatchBalance.findFirstOrThrow({
      where: { locationId, resourceId: milkId, batchCode: 'MILK-NEAR' },
    });
    const lotFar = await prisma.stockBatchBalance.findFirstOrThrow({
      where: { locationId, resourceId: milkId, batchCode: 'MILK-FAR' },
    });
    expect(Number(lotNear.quantity)).toBe(0);
    expect(Number(lotFar.quantity)).toBe(8);
    const balance = await prisma.stockBalance.findFirstOrThrow({ where: { locationId, resourceId: milkId } });
    expect(Number(balance.quantity)).toBeCloseTo(8, 3); // aggregate in sync
  });


  it('expired-only stock is blocked without allowExpired; allowed with the override', async () => {
    const locationId = await defaultLocationId();
    const past = new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 10);
    const paneer = await prisma.resource.findFirstOrThrow({ where: { companyId, itemCode: 'KIR-039' } });
    const paneerUpd = await authPut(invToken, `/api/resources/${paneer.id}`, { trackingMode: 'BATCH_EXPIRY' });
    expect(paneerUpd.status).toBe(200);

    // Opening stock of an expired lot (no PO needed).
    const open = await authPost(invToken, '/api/inventory/stock/opening-stock', {
      lines: [{ name: 'Paneer 200 g', quantity: 5, batchCode: 'PANEER-OLD', expiresAt: past }],
    });
    expect(open.status).toBe(201);

    // No fresh stock → issuing expired requires the authorized override.
    const blocked = await authPost(invToken, `/api/projects/${projectId}/procurement/stock/issue`, {
      lines: [{ resourceId: paneer.id, quantity: 1 }],
    });
    expect(blocked.status).toBe(422);
    expect(blocked.body.error?.message ?? blocked.body.message).toMatch(/expired/i);

    const allowed = await authPost(invToken, `/api/projects/${projectId}/procurement/stock/issue`, {
      lines: [{ resourceId: paneer.id, quantity: 1 }],
      allowExpired: true,
    });
    expect(allowed.status).toBe(201);
    const lot = await prisma.stockBatchBalance.findFirstOrThrow({
      where: { locationId, resourceId: paneer.id, batchCode: 'PANEER-OLD' },
    });
    expect(Number(lot.quantity)).toBe(4);
  });

  it('transfer moves lot qty with the batch (dispatch FEFO-allocates, receive recreates)', async () => {
    const locationId = await defaultLocationId();
    const warehouse = await authPost(invToken, '/api/inventory/warehouses', {
      name: 'Zone B',
      code: 'ZONE-B',
      address: 'Secunderabad',
    });
    expect(warehouse.status).toBe(201);
    const toLocationId = warehouse.body.data.id as string;

    const transfer = await authPost(invToken, '/api/inventory/transfers', {
      fromLocationId: locationId,
      toLocationId,
      lines: [{ resourceId: milkId, quantity: 3, unit: 'pouch' }],
    });
    expect(transfer.status).toBe(201);
    const transferId = transfer.body.data.id as string;
    await authPost(invToken, `/api/inventory/transfers/${transferId}/dispatch`);
    const received = await authPost(invToken, `/api/inventory/transfers/${transferId}/receive`);
    expect(received.status).toBe(200);

    // MILK-FAR had 8 after the FEFO issue → 3 transferred, 5 left at source.
    const src = await prisma.stockBatchBalance.findFirstOrThrow({
      where: { locationId, resourceId: milkId, batchCode: 'MILK-FAR' },
    });
    const dst = await prisma.stockBatchBalance.findFirstOrThrow({
      where: { locationId: toLocationId, resourceId: milkId, batchCode: 'MILK-FAR' },
    });
    expect(Number(src.quantity)).toBe(5);
    expect(Number(dst.quantity)).toBe(3);
    const srcAgg = await prisma.stockBalance.findFirstOrThrow({ where: { locationId, resourceId: milkId } });
    const dstAgg = await prisma.stockBalance.findFirstOrThrow({
      where: { locationId: toLocationId, resourceId: milkId },
    });
    expect(Number(srcAgg.quantity)).toBeCloseTo(5, 3);
    expect(Number(dstAgg.quantity)).toBeCloseTo(3, 3);
  });

  it('sales return GOOD restores the known lot sold (via invoice movement link)', async () => {
    const locationId = await defaultLocationId();
    const issue = await authPost(invToken, `/api/projects/${projectId}/procurement/stock/issue`, {
      lines: [{ resourceId: milkId, quantity: 2, unitPrice: 32 }],
      customerName: 'Walk-in customer',
    });
    expect(issue.status).toBe(201);
    expect(issue.body.data.draftInvoiceId).toBeTruthy();
    const invoiceId = issue.body.data.draftInvoiceId as string;

    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: { lineItems: { take: 1 } },
    });
    const ret = await authPost(invToken, '/api/inventory/transactions/returns/sales', {
      invoiceId,
      returnDate: new Date().toISOString().slice(0, 10),
      lines: [
        {
          invoiceLineItemId: invoice.lineItems[0]?.id,
          resourceId: milkId,
          quantity: 2,
          unit: 'pouch',
          rate: 32,
          returnKind: 'GOOD',
        },
      ],
    });
    expect(ret.status).toBe(201);

    // Restored to MILK-FAR (the lot the sale came from): 3 + 2 = 5.
    const lot = await prisma.stockBatchBalance.findFirstOrThrow({
      where: { locationId, resourceId: milkId, batchCode: 'MILK-FAR' },
    });
    expect(Number(lot.quantity)).toBe(5);
    const balance = await prisma.stockBalance.findFirstOrThrow({
      where: { locationId, resourceId: milkId },
    });
    expect(Number(balance.quantity)).toBeCloseTo(5, 3);
  });

  it('multi-line POS checkout → one draft invoice + AUTO_STOCK_ISSUE SO, FEFO lots returned (11.3)', async () => {
    // Stock up 3 more untracked items so the walk-in sale spans 5+ lines.
    const bread = await prisma.resource.findFirstOrThrow({ where: { companyId, itemCode: 'KIR-041' } });
    const eggs = await prisma.resource.findFirstOrThrow({ where: { companyId, itemCode: 'KIR-043' } });
    const cola = await prisma.resource.findFirstOrThrow({ where: { companyId, itemCode: 'KIR-080' } });
    const open = await authPost(invToken, '/api/inventory/stock/opening-stock', {
      lines: [
        { name: 'Brown Bread 400 g', quantity: 10 },
        { name: 'Eggs (Dozen)', quantity: 8 },
        { name: 'Cola 750 ml', quantity: 12 },
      ],
    });
    expect(open.status).toBe(201);

    const issue = await authPost(invToken, `/api/projects/${projectId}/procurement/stock/issue`, {
      lines: [
        { resourceId: milkId, quantity: 2, unitPrice: 30 }, // tracked → FEFO
        { resourceId: curdId, quantity: 3, unitPrice: 25 }, // tracked → FEFO
        { resourceId: bread.id, quantity: 2, unitPrice: 45 },
        { resourceId: eggs.id, quantity: 1, unitPrice: 72 },
        { resourceId: cola.id, quantity: 3, unitPrice: 40 },
      ],
      customerName: 'Counter Walk-in',
    });
    expect(issue.status).toBe(201);
    expect(issue.body.data.draftInvoiceId).toBeTruthy();

    // 11.3.5: server-side FEFO allocations come back per tracked line; the UI
    // only warns - it never chooses lot quantities.
    const milkLine = (issue.body.data.lines as Array<{
      resourceId: string;
      allocations: Array<{ batchCode: string; quantity: number; expiresAt: string | null }> | null;
    }>).find((l) => l.resourceId === milkId);
    expect(milkLine!.allocations).toBeTruthy();
    expect(milkLine!.allocations!.length).toBeGreaterThan(0);
    expect(milkLine!.allocations![0].batchCode).toBe('MILK-FAR'); // only fresh lot left
    const breadLine = (issue.body.data.lines as Array<{
      resourceId: string;
      allocations: Array<{ batchCode: string; quantity: number; expiresAt: string | null }> | null;
    }>).find((l) => l.resourceId === bread.id);
    expect(breadLine!.allocations).toBeNull(); // untracked

    // One AUTO_STOCK_ISSUE SO for the whole checkout (K7).
    const sales = await authGet(invToken, '/api/inventory/transactions/sales-orders');
    const counterSo = (sales.body.data as Array<{ customerName: string; notes?: string | null; status: string }>).filter(
      (so) => so.notes?.includes('AUTO_STOCK_ISSUE') && so.customerName === 'Counter Walk-in',
    );
    expect(counterSo).toHaveLength(1);
    expect(counterSo[0].status).toBe('INVOICED');

    // One draft invoice with one line per issued material.
    const invoices = await authGet(invToken, `/api/projects/${projectId}/invoices`);
    const draft = (invoices.body.data as Array<{ id: string; status: string }>).find(
      (i) => i.id === issue.body.data.draftInvoiceId,
    );
    expect(draft).toBeTruthy();
    expect(draft!.status).toBe('DRAFT');

    // Aggregate + lot rows stayed consistent across the whole checkout.
    const milkLot = await prisma.stockBatchBalance.findFirstOrThrow({
      where: { locationId: await defaultLocationId(), resourceId: milkId, batchCode: 'MILK-FAR' },
    });
    expect(Number(milkLot.quantity)).toBe(3);
  });

  it('batch read surfaces + trackingMode are Kirana-only (403 / 422 for non-Kirana RETAIL)', async () => {
    // owner@cityhardware.com is RETAIL but has NO Kirana vertical.
    const retailToken = await loginAs('owner@cityhardware.com');
    const batches = await authGet(retailToken, `/api/inventory/stock/batches?resourceId=${milkId}`);
    expect(batches.status).toBe(403);
    const summary = await authGet(retailToken, '/api/inventory/stock/expiry-summary');
    expect(summary.status).toBe(403);

    // A non-Kirana RETAIL tenant cannot flag an item BATCH_EXPIRY.
    const retailResources = await authGet(retailToken, '/api/resources?limit=5');
    const someResource = retailResources.body.data?.[0];
    if (someResource?.id) {
      const upd = await authPut(retailToken, `/api/resources/${someResource.id}`, {
        trackingMode: 'BATCH_EXPIRY',
      });
      expect(upd.status).toBe(422);
      expect(upd.body.error?.message ?? upd.body.message).toMatch(/Kirana/i);
    }
  });

  it('construction GRN needs NO batch/expiry fields (regression)', async () => {
    const constToken = await loginAs(CONSTRUCTION_OWNER);
    const nh45Id = await getProjectId(constToken, 'NH45');
    const constCompanyId = (
      await prisma.user.findFirstOrThrow({ where: { email: CONSTRUCTION_OWNER } })
    ).companyId;
    // Pick an ACTIVE construction material (prior suites may soft-delete items).
    const resource = await prisma.resource.findFirstOrThrow({
      where: { companyId: constCompanyId, isDeleted: false },
      select: { id: true },
    });
    const tag = `${Date.now()}`;
    const reqRes = await authPost(constToken, `/api/projects/${nh45Id}/procurement/requisitions`, {
      reqNumber: `C-IND-${tag}`,
      lines: [{ resourceId: resource.id, quantity: 5, unit: 'nos' }],
    });
    // Construction indents stay DRAFT (not auto-approved) - full submit→approve.
    expect(reqRes.status).toBe(201);
    expect(reqRes.body.data.status).toBe('DRAFT');
    const submitRes = await authPost(
      constToken,
      `/api/projects/${nh45Id}/procurement/requisitions/${reqRes.body.data.id}/submit`,
    );
    expect(submitRes.status).toBe(200);
    const approveReq = await authPost(
      constToken,
      `/api/projects/${nh45Id}/procurement/requisitions/${reqRes.body.data.id}/approve`,
    );
    expect(approveReq.status).toBe(200);
    const poRes = await authPost(constToken, `/api/projects/${nh45Id}/procurement/purchase-orders`, {
      poNumber: `C-PO-${tag}`,
      vendorName: 'Const Vendor',
      requisitionId: reqRes.body.data.id as string,
      lines: [{ resourceId: resource.id, quantity: 5, unit: 'nos', rate: 100 }],
    });
    const poId = poRes.body.data.id as string;
    // Construction POs start APPROVED (4.4 banding is inventory-only) - skip approve.
    expect(poRes.body.data.status).toBe('APPROVED');
    const grn = await authPost(constToken, `/api/projects/${nh45Id}/procurement/grn`, {
      grnNumber: `C-GRN-${tag}`,
      purchaseOrderId: poId,
      receivedDate: new Date().toISOString().slice(0, 10),
      // NO batch code, NO mfg/expiry - construction receipts stay batch-free.
      lines: [{ resourceId: resource.id, quantity: 5, unit: 'nos' }],
    });
    expect(grn.status).toBe(201);
    const batchRows = await prisma.stockBatchBalance.count({ where: { resourceId: resource.id } });
    expect(batchRows).toBe(0);
  });
});
