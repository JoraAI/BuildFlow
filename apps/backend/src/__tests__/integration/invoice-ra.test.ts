/**
 * RA invoice integration tests - cumulative math and retention.
 */
import { loginAs, authGet, authPost, getSeedProjectId } from './test-helpers';

const OWNER = 'owner@reddyconst.com';

describe('RA invoices (integration)', () => {
  let token: string;
  let projectId: string;

  beforeAll(async () => {
    token = await loginAs(OWNER);
    projectId = await getSeedProjectId(token);
  });

  it('lists seeded RA bill RA-2025-001 with retention', async () => {
    const res = await authGet(token, `/api/projects/${projectId}/invoices`);
    expect(res.status).toBe(200);
    const ra = (res.body.data as Array<{ invoiceNumber: string; invoiceType: string; retentionPct: number }>).find(
      (i) => i.invoiceNumber === 'RA-2025-001',
    );
    expect(ra).toBeTruthy();
    expect(ra!.invoiceType).toBe('RUNNING_ACCOUNT');
    expect(Number(ra!.retentionPct)).toBe(5);
  });

  it('returns only invoices for the requested project', async () => {
    const projectsRes = await authGet(token, '/api/projects');
    expect(projectsRes.status).toBe(200);
    const projects = projectsRes.body.data as Array<{ id: string; code: string }>;
    const otherProject = projects.find((p) => p.id !== projectId);

    const nh45Res = await authGet(token, `/api/projects/${projectId}/invoices`);
    expect(nh45Res.status).toBe(200);
    const nh45Numbers = (nh45Res.body.data as Array<{ invoiceNumber: string }>).map((i) => i.invoiceNumber);
    expect(nh45Numbers.length).toBeGreaterThan(0);
    expect(nh45Numbers).toContain('RA-2025-001');

    // Only verify cross-project isolation if a second project exists
    if (otherProject) {
      const otherRes = await authGet(token, `/api/projects/${otherProject.id}/invoices`);
      expect(otherRes.status).toBe(200);
      const otherNumbers = (otherRes.body.data as Array<{ invoiceNumber: string }>).map((i) => i.invoiceNumber);
      expect(otherNumbers).toEqual([]);
    }
  });

  it('creates RA bill #2 with previous certified from bill #1', async () => {
    const boqRes = await authGet(token, `/api/projects/${projectId}/boq`);
    expect(boqRes.status).toBe(200);
    let items = (boqRes.body.data?.items ?? []) as Array<{
      id: string;
      description: string;
      unit: string;
      rate: number;
      executedQty: number;
      billedCumulativeQty: number;
      billableQty: number;
    }>;
    expect(items.length).toBeGreaterThan(0);

    let boqItem = items.find((item) => Number(item.billableQty) >= 1);

    // Seeded RA may have already billed more than executed — record enough
    // measurement so billableQty becomes positive.
    if (!boqItem) {
      const target = items[0]!;
      const need = Math.max(
        50,
        Math.ceil(Number(target.billedCumulativeQty) - Number(target.executedQty) + 50),
      );
      const measureRes = await authPost(token, `/api/boq/${target.id}/measurements`, {
        quantity: need,
        notes: 'RA integration test measurement',
      });
      expect(measureRes.status).toBe(201);
      const refreshed = await authGet(token, `/api/projects/${projectId}/boq`);
      items = (refreshed.body.data?.items ?? []) as typeof items;
      boqItem =
        items.find((item) => item.id === target.id && Number(item.billableQty) >= 1) ??
        items.find((item) => Number(item.billableQty) >= 1);
    }
    expect(boqItem).toBeTruthy();

    const priorBilled = Number(boqItem!.billedCumulativeQty);
    const billable = Number(boqItem!.billableQty);
    const currentQty = Math.min(100, Math.floor(billable));
    expect(currentQty).toBeGreaterThan(0);
    const cumulativeQty = priorBilled + currentQty;
    const rate = Number(boqItem!.rate);
    const currentCertified = currentQty * rate;

    const res = await authPost(token, `/api/projects/${projectId}/invoices`, {
      invoiceNumber: `RA-TEST-${Date.now()}`,
      clientName: 'NHAI',
      clientState: 'Telangana',
      invoiceDate: '2025-04-30',
      dueDate: '2025-05-30',
      projectId,
      invoiceType: 'RUNNING_ACCOUNT',
      retentionPct: 5,
      gstRate: 18,
      lineItems: [
        {
          boqItemId: boqItem!.id,
          description: boqItem!.description,
          unit: boqItem!.unit,
          quantity: currentQty,
          currentQty,
          previousQty: priorBilled,
          cumulativeQty,
          rate,
        },
      ],
    });

    expect(res.status).toBe(201);
    const inv = res.body.data;
    expect(inv.invoiceType).toBe('RUNNING_ACCOUNT');
    expect(Number(inv.raSequence)).toBeGreaterThanOrEqual(2);
    expect(Number(inv.previousCertifiedTotal)).toBeGreaterThan(0);
    expect(Number(inv.currentCertifiedTotal)).toBeCloseTo(currentCertified, 0);
    expect(Number(inv.cumulativeCertifiedTotal)).toBeCloseTo(
      Number(inv.previousCertifiedTotal) + Number(inv.currentCertifiedTotal),
      0,
    );
    // FIX (FIN-H4): Retention is on currentCertifiedTotal (this bill's portion),
    // not cumulative. Prior bills already had their retention deducted.
    expect(Number(inv.retentionAmount)).toBeCloseTo(
      (Number(inv.currentCertifiedTotal) * 5) / 100,
      0,
    );
  });
});
