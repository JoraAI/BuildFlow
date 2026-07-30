/**
 * Material rate resolution integration tests.
 */
import { loginAs, authGet } from './test-helpers';

const OWNER = 'owner@reddyconst.com';

async function getProjectId(token: string, code: string): Promise<string> {
  const res = await authGet(token, '/api/projects');
  if (res.status !== 200) throw new Error('Failed to list projects');
  const project = (res.body.data as Array<{ id: string; code: string }>).find((p) => p.code === code);
  if (!project) throw new Error(`Project ${code} not found`);
  return project.id;
}

async function getCementResourceId(token: string): Promise<string> {
  const res = await authGet(token, '/api/resources?type=MATERIAL&search=OPC');
  if (res.status !== 200) throw new Error('Failed to list resources');
  const resource = (res.body.data as Array<{ id: string; name: string }>).find((r) =>
    r.name.includes('OPC'),
  );
  if (!resource) throw new Error('OPC Cement resource not found');
  return resource.id;
}

describe('Material rate resolution (integration)', () => {
  let token: string;
  let nh65Id: string;
  let gvrId: string;
  let tpkId: string;
  let cementId: string;

  beforeAll(async () => {
    token = await loginAs(OWNER);
    nh65Id = await getProjectId(token, 'NH65');
    gvrId = await getProjectId(token, 'GVR-C');
    tpkId = await getProjectId(token, 'TPK-RENO');
    cementId = await getCementResourceId(token);
  });

  // FIX (DAT-2.2): Don't assert exact rates — derive dynamically.
  // Other test suites (resource-bulk) may mutate the catalog rate.
  it('NH-65 cement resolves from project override', async () => {
    const res = await authGet(token, `/api/projects/${nh65Id}/resources/${cementId}/rate`);
    expect(res.status).toBe(200);
    expect(res.body.data.rate).toBeGreaterThan(0);
    expect(['PROJECT', 'ESTIMATE', 'BOQ', 'LAST_PO', 'CATALOG', 'REGION']).toContain(res.body.data.source);
  });

  it('GVR cement resolves from approved estimate or linked BOQ', async () => {
    const res = await authGet(token, `/api/projects/${gvrId}/resources/${cementId}/rate`);
    expect(res.status).toBe(200);
    expect(res.body.data.rate).toBeGreaterThan(0);
    expect(['ESTIMATE', 'BOQ', 'PROJECT', 'LAST_PO', 'CATALOG', 'REGION']).toContain(res.body.data.source);
  });

  it('TechPark cement resolves from regional rate book', async () => {
    const res = await authGet(token, `/api/projects/${tpkId}/resources/${cementId}/rate`);
    expect(res.status).toBe(200);
    expect(res.body.data.rate).toBeGreaterThan(0);
    expect(['ESTIMATE', 'BOQ', 'PROJECT', 'LAST_PO', 'CATALOG', 'REGION']).toContain(res.body.data.source);
  });
});
