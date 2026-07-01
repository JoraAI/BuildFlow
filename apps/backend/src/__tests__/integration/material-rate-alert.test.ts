/**
 * PO rate variance notification integration tests.
 */
import { loginAs, authGet, authPost } from './test-helpers';

const OWNER = 'owner@reddyconst.com';

async function getCementResourceId(token: string): Promise<string> {
  const res = await authGet(token, '/api/resources?type=MATERIAL&search=OPC');
  const resource = (res.body.data as Array<{ id: string; name: string }>).find((r) =>
    r.name.includes('OPC'),
  );
  if (!resource) throw new Error('OPC Cement resource not found');
  return resource.id;
}

async function getProjectId(token: string, code: string): Promise<string> {
  const res = await authGet(token, '/api/projects');
  const project = (res.body.data as Array<{ id: string; code: string }>).find((p) => p.code === code);
  if (!project) throw new Error(`Project ${code} not found`);
  return project.id;
}

describe('Material rate PO alerts (integration)', () => {
  let token: string;
  /** TPK-RENO avoids polluting NH-65 last-PO variance fixtures. */
  let projectId: string;
  let cementId: string;

  beforeAll(async () => {
    token = await loginAs(OWNER);
    projectId = await getProjectId(token, 'TPK-RENO');
    cementId = await getCementResourceId(token);
  });

  it('creates in-app notification when PO rate exceeds planned threshold', async () => {
    const reqNum = `IND-ALERT-${Date.now()}`;
    const reqRes = await authPost(token, `/api/projects/${projectId}/procurement/requisitions`, {
      reqNumber: reqNum,
      lines: [{ resourceId: cementId, quantity: 5, unit: 'bag' }],
    });
    expect(reqRes.status).toBe(201);
    const reqId = reqRes.body.data.id as string;

    await authPost(token, `/api/projects/${projectId}/procurement/requisitions/${reqId}/submit`);
    await authPost(token, `/api/projects/${projectId}/procurement/requisitions/${reqId}/approve`);

    const poRes = await authPost(token, `/api/projects/${projectId}/procurement/purchase-orders`, {
      poNumber: `PO-ALERT-${Date.now()}`,
      vendorName: 'High Rate Vendor',
      requisitionId: reqId,
      lines: [{ resourceId: cementId, quantity: 5, unit: 'bag', rate: 500 }],
    });
    expect(poRes.status).toBe(201);

    const notifRes = await authGet(token, '/api/notifications?limit=20');
    expect(notifRes.status).toBe(200);
    const items = notifRes.body.data.items as Array<{ type: string; body: string }>;
    const alert = items.find((n) => n.type === 'MATERIAL_RATE_VARIANCE' && n.body.includes('500'));
    expect(alert).toBeTruthy();
    expect(alert!.body).toContain('TPK-RENO');
  });

  it('returns material rate sheet PDF', async () => {
    const res = await authGet(token, `/api/reports/pdf/projects/${projectId}/material-rates`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.body.length).toBeGreaterThan(500);
  });
});
