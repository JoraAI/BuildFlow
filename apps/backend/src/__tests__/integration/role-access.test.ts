/**
 * Role-based access integration tests.
 */
import { loginAs, authPost, authGet, getSeedProjectId } from './test-helpers';

describe('Role-based access (integration)', () => {
  let projectId: string;
  let pendingBillId: string | null = null;

  beforeAll(async () => {
    const ownerToken = await loginAs('owner@reddyconst.com');
    projectId = await getSeedProjectId(ownerToken);
    const billsRes = await authGet(ownerToken, `/api/projects/${projectId}/bills`);
    const pending = (billsRes.body.data as Array<{ id: string; status: string }>).find(
      (b) => b.status === 'PENDING',
    );
    pendingBillId = pending?.id ?? null;
  });

  it('accountant cannot approve bills (403)', async () => {
    if (!pendingBillId) return;
    const token = await loginAs('accounts@reddyconst.com');
    const res = await authPost(token, `/api/bills/${pendingBillId}/approve`);
    expect(res.status).toBe(403);
  });

  it('supervisor cannot record bill payment (403)', async () => {
    const ownerToken = await loginAs('owner@reddyconst.com');
    const billsRes = await authGet(ownerToken, `/api/projects/${projectId}/bills`);
    const approved = (billsRes.body.data as Array<{ id: string; status: string }>).find(
      (b) => b.status === 'APPROVED',
    );
    if (!approved) return;

    const token = await loginAs('site@reddyconst.com');
    const res = await authPost(token, `/api/bills/${approved.id}/record-payment`, { amount: 1 });
    expect(res.status).toBe(403);
  });

  it('accountant can record payment on approved bill', async () => {
    const ownerToken = await loginAs('owner@reddyconst.com');
    const billsRes = await authGet(ownerToken, `/api/projects/${projectId}/bills`);
    const approved = (billsRes.body.data as Array<{ id: string; status: string; total: number; paidAmount: number }>).find(
      (b) => b.status === 'APPROVED' && Number(b.total) - Number(b.paidAmount) > 1,
    );
    if (!approved) return;

    const token = await loginAs('accounts@reddyconst.com');
    const res = await authPost(token, `/api/bills/${approved.id}/record-payment`, { amount: 1 });
    expect(res.status).toBe(200);
  });
});
