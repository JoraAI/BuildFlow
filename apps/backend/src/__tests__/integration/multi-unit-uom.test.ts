/**
 * Multi-unit UOM: company toggle, unit catalog, conversion on stock issue,
 * per-unit rate fallback (incl. distributor/customer).
 */
import request from 'supertest';
import { app } from '../../app';
import { prisma } from '../../lib/prisma';
import { authPost, authGet, authPut, registerInventoryAndLogin } from './test-helpers';

describe('Multi-unit UOM (integration)', () => {
  let token: string;
  let companyId: string;
  let projectId: string;

  beforeAll(async () => {
    const res = await registerInventoryAndLogin({
      suffix: `mu-${Date.now().toString().slice(-6)}`,
      companyName: 'Multi Unit Shop',
      ownerName: 'MU Owner',
      vertical: 'WHOLESALER',
    });
    token = res.token;
    companyId = res.companyId;
    projectId = res.defaultProjectId;
  });

  afterAll(async () => {
    if (!companyId) return;
    await prisma.stockMovement.deleteMany({
      where: { location: { companyId } },
    });
    await prisma.stockBalance.deleteMany({
      where: { location: { companyId } },
    });
    await prisma.stockLocation.deleteMany({ where: { companyId } });
    await prisma.invoiceLineItem.deleteMany({
      where: { invoice: { companyId } },
    });
    await prisma.invoice.deleteMany({ where: { companyId } });
    await prisma.materialPriceHistory.deleteMany({ where: { companyId } });
    await prisma.resourceUnit.deleteMany({
      where: { resource: { companyId } },
    });
    await prisma.resource.deleteMany({ where: { companyId } });
    await prisma.companyUnit.deleteMany({ where: { companyId } });
    await prisma.auditLog.deleteMany({ where: { companyId } });
    await prisma.project.deleteMany({ where: { companyId } });
    await prisma.user.deleteMany({ where: { companyId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
  });

  it('defaults multi-unit off; unit catalog seeds on list', async () => {
    const company = await authGet(token, '/api/settings/company');
    expect(company.status).toBe(200);
    expect(company.body.data.multiUnitEnabled).toBe(false);

    const units = await authGet(token, '/api/inventory/units');
    expect(units.status).toBe(200);
    const names = (units.body.data as Array<{ name: string }>).map((u) => u.name);
    expect(names).toEqual(expect.arrayContaining(['kg', 'bag', 'nos']));
  });

  it('rejects alternate units while feature is off', async () => {
    const res = await authPost(token, '/api/resources', {
      name: `Cement Off ${Date.now()}`,
      type: 'MATERIAL',
      unit: 'kg',
      rate: 10,
      distributorRate: 9,
      customerRate: 10,
      units: [
        { unitName: 'kg', isBase: true, conversionToBase: 1 },
        { unitName: 'bag', isBase: false, conversionToBase: 50, rate: 450 },
      ],
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('enables multi-unit, sells in bags, stock moves in kg', async () => {
    const enable = await authPut(token, '/api/settings/company', {
      multiUnitEnabled: true,
    });
    expect(enable.status).toBe(200);
    expect(enable.body.data.multiUnitEnabled).toBe(true);

    const create = await authPost(token, '/api/resources', {
      name: `OPC Multi ${Date.now()}`,
      type: 'MATERIAL',
      unit: 'kg',
      rate: 10,
      distributorRate: 8,
      customerRate: 10,
      costPrice: 5,
      units: [
        { unitName: 'kg', isBase: true, conversionToBase: 1 },
        {
          unitName: 'bag',
          isBase: false,
          conversionToBase: 50,
          rate: 400,
          distributorRate: 380,
          customerRate: null,
        },
      ],
    });
    expect(create.status).toBe(201);
    const resourceId = create.body.data.id as string;
    const units = create.body.data.units as Array<{
      unitName: string;
      isBase: boolean;
      conversionToBase: number;
    }>;
    expect(units.length).toBe(2);
    expect(units.find((u) => u.unitName === 'bag')?.conversionToBase).toBe(50);

    const open = await authPost(token, '/api/inventory/stock/opening-stock', {
      lines: [{ resourceId, quantity: 200, rate: 5 }],
    });
    expect(open.status).toBe(201);

    const issue = await authPost(token, `/api/projects/${projectId}/procurement/stock/issue`, {
      lines: [{ resourceId, quantity: 2, unit: 'bag', unitPrice: 380 }],
      customerName: 'Dist Buyer',
    });
    expect(issue.status).toBe(201);
    const draftInvoiceId = issue.body.data.draftInvoiceId as string | null;
    expect(draftInvoiceId).toBeTruthy();

    const summary = await authGet(
      token,
      `/api/projects/${projectId}/procurement/stock/summary`,
    );
    const row = (
      summary.body.data as Array<{ resourceId: string; balance: number }>
    ).find((r) => r.resourceId === resourceId);
    expect(row).toBeTruthy();
    expect(Number(row!.balance)).toBeCloseTo(100, 3);

    // Draft invoice must keep transaction unit + sell rate (not catalog base).
    const inv = await authGet(token, `/api/invoices/${draftInvoiceId}`);
    expect(inv.status).toBe(200);
    const invLines = inv.body.data.lineItems as Array<{
      quantity: number;
      unit: string;
      rate: number;
    }>;
    expect(invLines).toHaveLength(1);
    expect(invLines[0].unit).toBe('bag');
    expect(Number(invLines[0].quantity)).toBe(2);
    expect(Number(invLines[0].rate)).toBe(380);

    await authPut(token, '/api/settings/company', { multiUnitEnabled: false });
    const blocked = await authPost(token, '/api/resources', {
      name: `Blocked Alt ${Date.now()}`,
      type: 'MATERIAL',
      unit: 'kg',
      rate: 1,
      distributorRate: 1,
      customerRate: 1,
      units: [
        { unitName: 'kg', isBase: true, conversionToBase: 1 },
        { unitName: 'bag', isBase: false, conversionToBase: 50 },
      ],
    });
    expect(blocked.status).toBeGreaterThanOrEqual(400);
  });

  it('cannot deactivate a unit that is in use', async () => {
    await authPut(token, '/api/settings/company', { multiUnitEnabled: true });
    const units = await authGet(token, '/api/inventory/units');
    const kg = (units.body.data as Array<{ id: string; name: string }>).find(
      (u) => u.name === 'kg',
    );
    expect(kg).toBeTruthy();
    const del = await request(app)
      .delete(`/api/inventory/units/${kg!.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBeGreaterThanOrEqual(400);
  });
});
