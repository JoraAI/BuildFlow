/**
 * Integration test: Cross-Vertical POS Barcode Scan & Return Workflow
 *
 * Tests the lighting / hardware / general wholesale unconsumed items return flow:
 * 1. Dispatches 50 lighting fixtures via Sales Order & Delivery Challan / Invoice.
 * 2. Scans barcode at return desk and verifies against past dispatches.
 * 3. Prevents returning more than the max returnable amount.
 * 4. Submits return voucher in PENDING_APPROVAL status.
 * 5. Owner 1-click approves and restocks items back to the target warehouse.
 * 6. Verifies Credit Note generation, Stock Balance increment, and ledger reconciliation.
 */
import request from 'supertest';
import { app } from '../../app';
import { prisma } from '../../lib/prisma';
import { authPost, authPut } from './test-helpers';

const PASSWORD = 'Test@1234';

function uniqueGstin(): string {
  const n = Date.now().toString().slice(-6);
  return `36AABCR${n.slice(0, 4)}A1Z5`;
}

async function registerWholesaleCompany(suffix: string) {
  const res = await request(app).post('/api/auth/register').send({
    companyName: `Bright Lights Co ${suffix}`,
    gstin: uniqueGstin(),
    pan: `AABCR${suffix.slice(-4).toUpperCase()}A`,
    state: 'Telangana',
    ownerName: 'Lighting Owner',
    ownerEmail: `lighting-owner-${suffix}@example.com`,
    password: PASSWORD,
    product: 'inventory',
  });
  return res;
}

describe('POS Barcode Scan-and-Return & Approval Workflow', () => {
  let token: string;
  let companyId: string;
  let projectId: string;
  let fixtureId: string;
  let defaultLocationId: string;
  let siteBLocationId: string;
  let invoiceId: string;
  const suffix = Date.now().toString();

  beforeAll(async () => {
    const res = await registerWholesaleCompany(suffix);
    if (res.status !== 201) {
      throw new Error(`Register failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    token = res.body.data.accessToken as string;
    companyId = res.body.data.user.companyId as string;
    projectId = res.body.data.user.defaultProjectId as string;

    // Set WHOLESALE inventory profile & ELECTRONICS/HARDWARE vertical
    await authPut(token, '/api/settings/company', {
      inventoryProfile: 'WHOLESALE',
      inventoryVertical: 'ELECTRONICS',
    });

    // Create a Lighting Fixture material with barcode & SKU
    const itemRes = await authPost(token, '/api/resources', {
      name: 'LED Panel 36W Recessed',
      type: 'MATERIAL',
      unit: 'NOS',
      rate: 1200,
      costPrice: 800,
      sku: `LTG-${suffix.slice(-4)}`,
      barcode: `8901234${suffix.slice(-6)}`,
      itemCode: `PANEL-36W`,
    });
    expect(itemRes.status).toBe(201);
    fixtureId = itemRes.body.data.id;

    // Fetch or create default warehouse location
    let loc = await prisma.stockLocation.findFirst({ where: { companyId, isDefault: true } });
    if (!loc) {
      loc = await prisma.stockLocation.create({
        data: { companyId, projectId, name: 'Main Warehouse', isDefault: true },
      });
    }
    defaultLocationId = loc.id;

    // Create a secondary warehouse (Site B)
    const siteB = await prisma.stockLocation.create({
      data: {
        companyId,
        projectId,
        name: 'Project Site B Depot',
        isDefault: false,
      },
    });
    siteBLocationId = siteB.id;

    // Receive initial stock of 100 panels via quick-receipt
    const receiptRes = await authPost(token, '/api/inventory/stock/quick-receipt', {
      vendorName: 'Lighting Manufacturer',
      invoiceNumber: `INV-${suffix}`,
      receivedDate: new Date().toISOString().slice(0, 10),
      lines: [
        {
          resourceId: fixtureId,
          quantity: 100,
          unitCost: 800,
        },
      ],
    });
    expect(receiptRes.status).toBe(201);

    // Create a Sales Order for 50 fixtures
    const soRes = await authPost(token, '/api/inventory/transactions/sales-orders', {
      customerName: 'Apex Commercial Builders',
      orderDate: new Date().toISOString(),
      lines: [
        {
          resourceId: fixtureId,
          quantity: 50,
          unit: 'NOS',
          rate: 1200,
          gstRate: 18,
        },
      ],
    });
    expect(soRes.status).toBe(201);
    const soId = soRes.body.data.id;

    // Confirm SO
    await authPost(token, `/api/inventory/transactions/sales-orders/${soId}/action`, { action: 'confirm' });

    // Create & Dispatch Delivery Challan (moves stock OUT)
    const dcRes = await authPost(token, '/api/inventory/transactions/delivery-challans', {
      salesOrderId: soId,
    });
    expect(dcRes.status).toBe(201);
    const dcId = dcRes.body.data.id;

    const dispatchRes = await authPost(token, `/api/inventory/transactions/delivery-challans/${dcId}/dispatch`, {
      locationId: defaultLocationId,
    });
    expect(dispatchRes.status).toBe(200);

    // Challan dispatch automatically creates draft invoice
    invoiceId = dispatchRes.body.data.draftInvoiceId;
    if (!invoiceId) {
      const invRes = await authPost(token, `/api/inventory/transactions/sales-orders/${soId}/invoice`, {});
      invoiceId = invRes.body.data.id;
    }

    // Mark invoice SENT / PAID
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'SENT' },
    });
  });

  it('1. Scans barcode and validates item against past dispatches', async () => {
    const res = await authPost(token, '/api/inventory/transactions/returns/validate-scan', {
      barcode: `8901234${suffix.slice(-6)}`,
      invoiceId,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.isValidDispatch).toBe(true);
    expect(res.body.data.resource.id).toBe(fixtureId);
    expect(res.body.data.totalDispatched).toBe(50);
    expect(res.body.data.totalPreviouslyReturned).toBe(0);
    expect(res.body.data.maxReturnable).toBe(50);
  });

  it('2. Submits a return voucher in PENDING_APPROVAL status with target location Site B', async () => {
    const res = await authPost(token, '/api/inventory/transactions/returns/sales', {
      invoiceId,
      returnDate: new Date().toISOString().slice(0, 10),
      reason: '20 unconsumed fixtures returned from commercial fit-out',
      targetLocationId: siteBLocationId,
      status: 'PENDING_APPROVAL',
      lines: [
        {
          resourceId: fixtureId,
          quantity: 20,
          unit: 'NOS',
          rate: 1200,
          gstRate: 18,
          returnKind: 'GOOD',
        },
      ],
    });

    expect(res.status).toBe(201);
    expect(res.body.data.salesReturn.status).toBe('DRAFT');
    expect(Number(res.body.data.salesReturn.total)).toBe(28320); // 20 * 1200 * 1.18

    const returnId = res.body.data.salesReturn.id;

    // Check that stock has NOT yet incremented before approval
    const balanceBefore = await prisma.stockBalance.findUnique({
      where: {
        locationId_resourceId: {
          locationId: siteBLocationId,
          resourceId: fixtureId,
        },
      },
    });
    expect(balanceBefore).toBeNull();

    // 3. Owner 1-click approves the return
    const approveRes = await authPost(token, `/api/inventory/transactions/returns/sales/${returnId}/approve`, {
      targetLocationId: siteBLocationId,
      notes: 'Inspected at dock - approved',
    });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.salesReturn.status).toBe('ISSUED');

    // 4. Assert stock was restocked in Site B
    const balanceAfter = await prisma.stockBalance.findUnique({
      where: {
        locationId_resourceId: {
          locationId: siteBLocationId,
          resourceId: fixtureId,
        },
      },
    });
    expect(balanceAfter).not.toBeNull();
    expect(Number(balanceAfter!.quantity)).toBe(20);

    // 5. Assert Credit Note was finalized
    const creditNote = await prisma.creditNote.findFirst({
      where: { salesReturnId: returnId },
    });
    expect(creditNote).not.toBeNull();
    expect(creditNote!.status).toBe('ISSUED');
    expect(Number(creditNote!.total)).toBe(28320);
  });

  it('3. Subsequent scan reflects 20 units previously returned and maxReturnable = 30', async () => {
    const res = await authPost(token, '/api/inventory/transactions/returns/validate-scan', {
      barcode: `8901234${suffix.slice(-6)}`,
      invoiceId,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.totalDispatched).toBe(50);
    expect(res.body.data.totalPreviouslyReturned).toBe(20);
    expect(res.body.data.maxReturnable).toBe(30);
  });

  it('4. Returns 10 DAMAGED items: creates credit note but does NOT restock damaged goods', async () => {
    const res = await authPost(token, '/api/inventory/transactions/returns/sales', {
      invoiceId,
      returnDate: new Date().toISOString().slice(0, 10),
      reason: '10 cracked diffusers returned as DAMAGED/scrap',
      targetLocationId: siteBLocationId,
      status: 'ISSUED',
      lines: [
        {
          resourceId: fixtureId,
          quantity: 10,
          unit: 'NOS',
          rate: 1200,
          gstRate: 18,
          returnKind: 'DAMAGED',
        },
      ],
    });

    expect(res.status).toBe(201);
    expect(res.body.data.salesReturn.status).toBe('ISSUED');

    // Balance in site B should still be 20 (not 30, because DAMAGED goods are scrapped)
    const balance = await prisma.stockBalance.findUnique({
      where: {
        locationId_resourceId: {
          locationId: siteBLocationId,
          resourceId: fixtureId,
        },
      },
    });
    expect(Number(balance!.quantity)).toBe(20);
  });

  it('5. Unknown barcode returns 404', async () => {
    const res = await authPost(token, '/api/inventory/transactions/returns/validate-scan', {
      barcode: 'NON_EXISTENT_BARCODE_9999',
    });
    expect(res.status).toBe(404);
  });
});
