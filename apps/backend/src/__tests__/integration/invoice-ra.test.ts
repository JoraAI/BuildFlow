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
    const boqItem = boqRes.body.data?.items?.[0];
    expect(boqItem).toBeTruthy();

    const prevCumulative = 400;
    const currentQty = 100;
    const cumulativeQty = prevCumulative + currentQty;
    const rate = Number(boqItem.rate);
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
          boqItemId: boqItem.id,
          description: boqItem.description,
          unit: boqItem.unit,
          quantity: currentQty,
          currentQty,
          previousQty: prevCumulative,
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
