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

  it('NH-65 cement resolves from project override (435)', async () => {
    const res = await authGet(token, `/api/projects/${nh65Id}/resources/${cementId}/rate`);
    expect(res.status).toBe(200);
    expect(res.body.data.rate).toBe(435);
    expect(res.body.data.source).toBe('PROJECT');
  });

  it('GVR cement resolves from approved estimate or linked BOQ (445)', async () => {
    const res = await authGet(token, `/api/projects/${gvrId}/resources/${cementId}/rate`);
    expect(res.status).toBe(200);
    expect(res.body.data.rate).toBe(445);
    expect(['ESTIMATE', 'BOQ']).toContain(res.body.data.source);
    expect(res.body.data.sourceRef).toMatch(/GVR|EST-/i);
  });

  it('TechPark cement resolves from regional rate book (438)', async () => {
    const res = await authGet(token, `/api/projects/${tpkId}/resources/${cementId}/rate`);
    expect(res.status).toBe(200);
    expect(res.body.data.rate).toBe(438);
    expect(res.body.data.source).toBe('REGION');
    expect(res.body.data.sourceRef).toContain('AP Tier-2');
  });
});
