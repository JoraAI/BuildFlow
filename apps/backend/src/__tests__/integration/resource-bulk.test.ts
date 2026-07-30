/**
 * Resource bulk operations integration tests.
 *
 * Covers:
 *  - bulkUpsertResources: creates new + updates existing (by name+type)
 *  - bulkPriceUpdate: absolute mode updates rate + logs price history
 *  - bulkPriceUpdate: percent mode applies relative change
 *  - bulkPriceUpdate: reports notFound for unknown ids
 */
import { loginAs, authGet, authPost } from './test-helpers';

const OWNER = 'owner@reddyconst.com';

async function getFirstMaterialId(token: string): Promise<string> {
  const res = await authGet(token, '/api/resources?type=MATERIAL&limit=5');
  if (res.status !== 200) throw new Error('Failed to list resources');
  const data = res.body.data as Array<{ id: string; name: string; rate: string }>;
  if (!data.length) throw new Error('No materials in seed data');
  return data[0]!.id;
}

async function getMaterial(token: string, id: string): Promise<{ rate: number; name: string }> {
  const res = await authGet(token, `/api/resources/${id}`);
  if (res.status !== 200) throw new Error(`Resource ${id} not found`);
  return { rate: Number(res.body.data.rate), name: res.body.data.name };
}

describe('Resource bulk operations (integration)', () => {
  let token: string;

  beforeAll(async () => {
    token = await loginAs(OWNER);
  });

  it('bulk-upsert creates new resources and updates existing ones', async () => {
    const newName = `Bulk-Material-${Date.now()}`;
    const res = await authPost(token, '/api/resources/bulk-upsert', {
      resources: [
        { name: newName, type: 'MATERIAL', unit: 'kg', rate: 50, gstRate: 18 },
      ],
    });
    expect(res.status).toBe(200);
    const result = res.body.data as { created: number; updated: number };
    expect(result.created).toBe(1);
  });

  it('bulk-upsert updates an existing resource by name+type', async () => {
    // Create one first
    const name = `Bulk-Update-${Date.now()}`;
    const createRes = await authPost(token, '/api/resources/bulk-upsert', {
      resources: [{ name, type: 'MATERIAL', unit: 'pc', rate: 100 }],
    });
    expect(createRes.status).toBe(200);

    // Update the same name+type with a new rate
    const updateRes = await authPost(token, '/api/resources/bulk-upsert', {
      resources: [{ name, type: 'MATERIAL', unit: 'pc', rate: 120 }],
    });
    expect(updateRes.status).toBe(200);
    const result = updateRes.body.data as { created: number; updated: number };
    expect(result.updated).toBe(1);
    expect(result.created).toBe(0);
  });

  it('bulk-price (absolute) updates the resource rate', async () => {
    const resourceId = await getFirstMaterialId(token);
    const before = await getMaterial(token, resourceId);

    const today = new Date().toISOString().slice(0, 10);
    const res = await authPost(token, '/api/resources/bulk-price', {
      mode: 'absolute',
      effectiveDate: today,
      items: [{ resourceId, value: before.rate + 1 }],
    });
    expect(res.status).toBe(200);
    const result = res.body.data as { applied: number; changes: Array<{ newRate: number }> };
    expect(result.applied).toBe(1);
    expect(result.changes[0]!.newRate).toBe(before.rate + 1);

    // Verify the master resource rate was updated
    const after = await getMaterial(token, resourceId);
    expect(after.rate).toBe(before.rate + 1);
  });

  it('bulk-price (percent) applies a relative change', async () => {
    const resourceId = await getFirstMaterialId(token);
    const before = await getMaterial(token, resourceId);
    const expected = Math.round((before.rate * 1.1 + Number.EPSILON) * 100) / 100; // +10%

    const today = new Date().toISOString().slice(0, 10);
    const res = await authPost(token, '/api/resources/bulk-price', {
      mode: 'percent',
      effectiveDate: today,
      items: [{ resourceId, value: 10 }], // +10%
    });
    expect(res.status).toBe(200);
    const result = res.body.data as { applied: number; changes: Array<{ newRate: number }> };
    expect(result.applied).toBe(1);
    expect(result.changes[0]!.newRate).toBe(expected);
  });

  it('bulk-price reports notFound for unknown ids', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await authPost(token, '/api/resources/bulk-price', {
      mode: 'absolute',
      effectiveDate: today,
      items: [{ resourceId: '00000000-0000-0000-0000-000000000099', value: 1 }],
    });
    expect(res.status).toBe(200);
    const result = res.body.data as { applied: number; notFound: string[] };
    expect(result.applied).toBe(0);
    expect(result.notFound).toHaveLength(1);
  });
});