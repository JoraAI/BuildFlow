/**
 * Bill payment integration tests - partial/full pay, paidAmount, WO paidTotal.
 */
import { loginAs, authGet, authPost, getSeedProjectId } from './test-helpers';

const OWNER = 'owner@reddyconst.com';

describe('Bill payment (integration)', () => {
  let token: string;
  let projectId: string;

  beforeAll(async () => {
    token = await loginAs(OWNER);
    projectId = await getSeedProjectId(token);
  });

  it('records partial payment and keeps bill APPROVED', async () => {
    const woRes = await authGet(token, `/api/projects/${projectId}/subcontract/work-orders`);
    const wo = (woRes.body.data as Array<{ id: string; woNumber: string }>).find(
      (w) => w.woNumber === 'WO-001',
    );
    expect(wo).toBeTruthy();

    const createRes = await authPost(
      token,
      `/api/projects/${projectId}/subcontract/work-orders/${wo!.id}/measurements`,
      {
        periodLabel: 'Bill pay partial',
        lines: [{ description: 'Partial pay test', quantity: 2, unit: 'cum', rate: 500 }],
      },
    );
    expect(createRes.status).toBe(201);
    const measId = createRes.body.data.id as string;

    await authPost(token, `/api/projects/${projectId}/subcontract/measurements/${measId}/submit`);
    const approveRes = await authPost(
      token,
      `/api/projects/${projectId}/subcontract/measurements/${measId}/approve`,
      { createBill: true },
    );
    expect(approveRes.status).toBe(200);
    const billId = approveRes.body.data.bill.id as string;

    await authPost(token, `/api/bills/${billId}/approve`);
    const partialRes = await authPost(token, `/api/bills/${billId}/record-payment`, { amount: 500 });
    expect(partialRes.status).toBe(200);
    expect(partialRes.body.data.status).toBe('APPROVED');
    expect(Number(partialRes.body.data.paidAmount)).toBe(500);

    const getRes = await authGet(token, `/api/bills/${billId}`);
    expect(Number(getRes.body.data.paidAmount)).toBe(500);
  });

  it('full pay via pay endpoint sets PAID and updates WO paidTotal', async () => {
    const woRes = await authGet(token, `/api/projects/${projectId}/subcontract/work-orders`);
    const wo = (woRes.body.data as Array<{ id: string; woNumber: string }>).find(
      (w) => w.woNumber === 'WO-001',
    );
    expect(wo).toBeTruthy();

    const summaryBefore = await authGet(
      token,
      `/api/projects/${projectId}/subcontract/work-orders/${wo!.id}/summary`,
    );
    const paidBefore = Number(summaryBefore.body.data.paidTotal);

    const createRes = await authPost(
      token,
      `/api/projects/${projectId}/subcontract/work-orders/${wo!.id}/measurements`,
      {
        periodLabel: 'Bill pay full',
        lines: [{ description: 'Full pay test', quantity: 4, unit: 'cum', rate: 500 }],
      },
    );
    const measId = createRes.body.data.id as string;
    await authPost(token, `/api/projects/${projectId}/subcontract/measurements/${measId}/submit`);
    const approveRes = await authPost(
      token,
      `/api/projects/${projectId}/subcontract/measurements/${measId}/approve`,
      { createBill: true },
    );
    const bill = approveRes.body.data.bill as { id: string; total: number | string };
    const billId = bill.id;
    const netTotal = Number(bill.total);

    await authPost(token, `/api/bills/${billId}/approve`);
    const payRes = await authPost(token, `/api/bills/${billId}/pay`);
    expect(payRes.status).toBe(200);
    expect(payRes.body.data.status).toBe('PAID');
    expect(Number(payRes.body.data.paidAmount)).toBeCloseTo(netTotal, 1);

    const summaryAfter = await authGet(
      token,
      `/api/projects/${projectId}/subcontract/work-orders/${wo!.id}/summary`,
    );
    expect(Number(summaryAfter.body.data.paidTotal)).toBeGreaterThanOrEqual(paidBefore + netTotal - 1);
  });

  it('updates project summary paidSpend after payment', async () => {
    const woRes = await authGet(token, `/api/projects/${projectId}/subcontract/work-orders`);
    const wo = (woRes.body.data as Array<{ id: string; woNumber: string }>).find(
      (w) => w.woNumber === 'WO-001',
    );
    expect(wo).toBeTruthy();

    const createRes = await authPost(
      token,
      `/api/projects/${projectId}/subcontract/work-orders/${wo!.id}/measurements`,
      {
        periodLabel: 'Summary pay test',
        lines: [{ description: 'Summary test', quantity: 1, unit: 'cum', rate: 1000 }],
      },
    );
    const measId = createRes.body.data.id as string;
    await authPost(token, `/api/projects/${projectId}/subcontract/measurements/${measId}/submit`);
    const approveRes = await authPost(
      token,
      `/api/projects/${projectId}/subcontract/measurements/${measId}/approve`,
      { createBill: true },
    );
    const billId = approveRes.body.data.bill.id as string;
    await authPost(token, `/api/bills/${billId}/approve`);

    const summaryBeforePay = await authGet(token, `/api/projects/${projectId}/summary`);
    const paidBeforePay = Number(summaryBeforePay.body.data.paidSpend);

    const payAmount = 200;
    const payRes = await authPost(token, `/api/bills/${billId}/record-payment`, { amount: payAmount });
    expect(payRes.status).toBe(200);

    const billAfter = await authGet(token, `/api/bills/${billId}`);
    expect(Number(billAfter.body.data.paidAmount)).toBeGreaterThanOrEqual(payAmount);

    const summaryAfter = await authGet(token, `/api/projects/${projectId}/summary`);
    expect(Number(summaryAfter.body.data.paidSpend)).toBeGreaterThanOrEqual(paidBeforePay + payAmount - 0.01);
    expect(Number(summaryAfter.body.data.committedSpend)).toBeGreaterThan(0);
  });

  it('rejects payment on unapproved bill', async () => {
    const billsRes = await authGet(token, `/api/projects/${projectId}/bills`);
    const pending = (billsRes.body.data as Array<{ id: string; status: string }>).find(
      (b) => b.status === 'PENDING',
    );
    if (!pending) return;

    const res = await authPost(token, `/api/bills/${pending.id}/record-payment`, { amount: 100 });
    expect(res.status).toBe(400);
  });
});
