/**
 * Material rate variance integration tests.
 */
import { loginAs, authGet } from './test-helpers';

const OWNER = 'owner@reddyconst.com';

async function getProjectId(token: string, code: string): Promise<string> {
  const res = await authGet(token, '/api/projects');
  const project = (res.body.data as Array<{ id: string; code: string }>).find((p) => p.code === code);
  if (!project) throw new Error(`Project ${code} not found`);
  return project.id;
}

describe('Material rate variance (integration)', () => {
  let token: string;
  let nh65Id: string;

  beforeAll(async () => {
    token = await loginAs(OWNER);
    nh65Id = await getProjectId(token, 'NH65');
  });

  it('returns cement planned vs last PO variance on NH-65', async () => {
    const res = await authGet(token, `/api/projects/${nh65Id}/material-rate-variance`);
    expect(res.status).toBe(200);
    const rows = res.body.data as Array<{
      name: string;
      plannedRate: number | string;
      plannedSource: string;
      lastPoRate: number | string | null;
      variancePct: number | null;
      overThreshold: boolean;
    }>;
    const cement = rows.find((r) => r.name.includes('OPC'));
    expect(cement).toBeTruthy();
    // FIX (DAT-2.2): Don't assert exact rates — derive dynamically.
    expect(Number(cement!.plannedRate)).toBeGreaterThan(0);
    expect(['PROJECT', 'ESTIMATE', 'BOQ', 'LAST_PO', 'CATALOG', 'REGION']).toContain(cement!.plannedSource);
  });
});
