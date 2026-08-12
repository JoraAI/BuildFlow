/**
 * Phase 5 integration smoke tests - petty cash, punch list, RFI, drawings, portal scope.
 */
import request from 'supertest';
import { app } from '../../app';
import { loginAs, authGet, authPost, authPut, getSeedProjectId } from './test-helpers';

const OWNER = 'owner@reddyconst.com';

describe('Phase 5 modules (integration)', () => {
  let token: string;
  let projectId: string;

  beforeAll(async () => {
    token = await loginAs(OWNER);
    projectId = await getSeedProjectId(token);
  });

  it('creates and lists a petty cash entry', async () => {
    const createRes = await authPost(token, '/api/petty-cash', {
      projectId,
      description: 'Site tea',
      category: 'TEA_SNACKS',
      amount: 250,
      expenseDate: '2026-07-31',
      paidTo: 'Vendor',
    });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.status).toBe('PENDING');

    const getRes = await authGet(token, `/api/petty-cash/${createRes.body.data.id}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.id).toBe(createRes.body.data.id);
    expect(getRes.body.data.project?.id).toBe(projectId);

    const listRes = await authGet(token, `/api/petty-cash?projectId=${projectId}&limit=100`);
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body.data)).toBe(true);
    expect(listRes.body.data.some((r: { id: string }) => r.id === createRes.body.data.id)).toBe(true);
  });

  it('reconciles petty cash with guarded status transition', async () => {
    const createRes = await authPost(token, '/api/petty-cash', {
      description: 'Reconcile test',
      category: 'MISC_CASH',
      amount: 100,
      expenseDate: '2026-07-31',
      paidTo: 'Worker',
    });
    const id = createRes.body.data.id as string;

    const ok = await authPut(token, `/api/petty-cash/${id}`, { status: 'RECONCILED' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe('RECONCILED');

    const bad = await authPut(token, `/api/petty-cash/${id}`, { status: 'PENDING' });
    expect(bad.status).toBe(400);
  });

  it('creates punch item and closes via status workflow', async () => {
    const createRes = await authPost(token, '/api/punch-list', {
      projectId,
      title: 'Snag test',
      priority: 'HIGH',
    });
    expect(createRes.status).toBe(201);
    const id = createRes.body.data.id as string;

    const progress = await authPut(token, `/api/punch-list/${id}`, { status: 'IN_PROGRESS' });
    expect(progress.status).toBe(200);

    const closed = await authPut(token, `/api/punch-list/${id}`, { status: 'CLOSED' });
    expect(closed.status).toBe(200);
    expect(closed.body.data.status).toBe('CLOSED');
  });

  it('creates RFI and answers it', async () => {
    const createRes = await authPost(token, '/api/rfis', {
      projectId,
      subject: 'Clarify spec',
      question: 'Which cement grade?',
    });
    expect(createRes.status).toBe(201);
    const id = createRes.body.data.id as string;

    const answerRes = await authPost(token, `/api/rfis/${id}/answer`, {
      answer: 'Use OPC 53 as per drawing A-101.',
    });
    expect(answerRes.status).toBe(200);
    expect(answerRes.body.data.status).toBe('ANSWERED');
  });

  it('creates drawing and fetches by id', async () => {
    const createRes = await authPost(token, '/api/drawings', {
      projectId,
      drawingNo: `DWG-${Date.now()}`,
      title: 'Foundation plan',
      discipline: 'STRUCTURAL',
    });
    expect(createRes.status).toBe(201);
    const id = createRes.body.data.id as string;

    const getRes = await authGet(token, `/api/drawings/${id}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.drawingNo).toBe(createRes.body.data.drawingNo);
  });

  it('enhanced portal omits budget without financials scope', async () => {
    const portalRes = await authPost(token, `/api/projects/${projectId}/portal-access`, {
      label: 'Progress only',
      scopes: ['VIEW_PROGRESS'],
      expiresInDays: 7,
    });
    expect(portalRes.status).toBe(201);
    const portalToken = portalRes.body.data.token as string;
    expect(portalToken.length).toBeGreaterThanOrEqual(32);

    const basic = await request(app).get(`/api/portal/${portalToken}`);
    expect(basic.status).toBe(200);

    const enhanced = await request(app).get(`/api/portal/${portalToken}/enhanced`);
    expect(enhanced.status).toBe(200);
    expect(enhanced.body.data.project.budget).toBeUndefined();
  });
});
