/**
 * Proposal status transition integration tests.
 *
 * Regression test for PROPREJ-1: the ALLOWED_TRANSITIONS whitelist
 * used 'REJECTED' (an EstimateStatus) instead of 'LOST' (the correct
 * ProposalStatus) for IN_REVIEW, and was missing 'LOST' for APPROVED.
 * This caused "Mark as Lost" to return 400 for APPROVED/IN_REVIEW proposals.
 */
import request from 'supertest';
import { app } from '../../app';
import { loginAs, authPost } from './test-helpers';
import { ProjectType } from '@buildflow/shared';

const OWNER = 'owner@reddyconst.com';

function authPatch(token: string, path: string, body?: object) {
  const req = request(app).patch(path).set('Authorization', `Bearer ${token}`);
  return body !== undefined ? req.send(body) : req.send({});
}

async function createProposal(token: string): Promise<string> {
  const res = await authPost(token, '/api/proposals', {
    title: `Transition Test ${Date.now()}`,
    clientName: 'Test Client',
    projectType: ProjectType.MID,
  });
  if (res.status !== 201) throw new Error(`Create proposal failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data.id as string;
}

async function setProposalStatus(token: string, id: string, status: string, reason?: string) {
  const body: Record<string, unknown> = { status };
  if (reason !== undefined) body.rejectionReason = reason;
  return authPatch(token, `/api/proposals/${id}`, body);
}

describe('Proposal status transitions (integration)', () => {
  let token: string;

  beforeAll(async () => {
    token = await loginAs(OWNER);
  });

  it('DRAFT → IN_REVIEW is allowed', async () => {
    const id = await createProposal(token);
    const res = await setProposalStatus(token, id, 'IN_REVIEW');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('IN_REVIEW');
  });

  it('IN_REVIEW → LOST is allowed (PROPREJ-1 regression)', async () => {
    const id = await createProposal(token);
    await setProposalStatus(token, id, 'IN_REVIEW');
    const res = await setProposalStatus(token, id, 'LOST', 'Bid withdrawn by client');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('LOST');
    expect(res.body.data.rejectionReason).toBe('Bid withdrawn by client');
  });

  it('APPROVED → LOST is allowed (PROPREJ-1 regression)', async () => {
    const id = await createProposal(token);
    await setProposalStatus(token, id, 'IN_REVIEW');
    await setProposalStatus(token, id, 'APPROVED');
    const res = await setProposalStatus(token, id, 'LOST');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('LOST');
  });

  it('SENT → LOST is allowed', async () => {
    const id = await createProposal(token);
    await setProposalStatus(token, id, 'IN_REVIEW');
    await setProposalStatus(token, id, 'APPROVED');
    await setProposalStatus(token, id, 'SENT');
    const res = await setProposalStatus(token, id, 'LOST', 'Underbid by competitor');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('LOST');
    expect(res.body.data.rejectionReason).toBe('Underbid by competitor');
  });

  it('DRAFT → WON is rejected (invalid transition)', async () => {
    const id = await createProposal(token);
    const res = await setProposalStatus(token, id, 'WON');
    expect(res.status).toBe(400);
    expect(res.body.error?.message).toMatch(/Invalid status transition/i);
  });

  it('LOST → APPROVED is rejected (cannot revive a lost proposal)', async () => {
    const id = await createProposal(token);
    await setProposalStatus(token, id, 'IN_REVIEW');
    await setProposalStatus(token, id, 'LOST');
    const res = await setProposalStatus(token, id, 'APPROVED');
    expect(res.status).toBe(400);
    expect(res.body.error?.message).toMatch(/Invalid status transition/i);
  });
});