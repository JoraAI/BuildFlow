/**
 * Material catalog integration tests - list, create, type filter.
 */
import { loginAs, authGet, authPost } from './test-helpers';

const OWNER = 'owner@reddyconst.com';

describe('Material catalog (integration)', () => {
  let token: string;

  beforeAll(async () => {
    token = await loginAs(OWNER);
  });

  it('lists MATERIAL resources with pagination meta', async () => {
    const res = await authGet(token, '/api/resources?type=MATERIAL&limit=200');
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(5);
    expect((res.body.data as Array<{ type: string }>).every((r) => r.type === 'MATERIAL')).toBe(true);
  });

  it('creates a material and returns it in MATERIAL list', async () => {
    const name = `Test Material ${Date.now()}`;
    const createRes = await authPost(token, '/api/resources', {
      name,
      type: 'MATERIAL',
      unit: 'bag',
      rate: 499,
      category: 'Cement',
      gstRate: 18,
    });
    expect(createRes.status).toBe(201);
    const created = createRes.body.data as { id: string; name: string; type: string };
    expect(created.name).toBe(name);
    expect(created.type).toBe('MATERIAL');

    const listRes = await authGet(token, `/api/resources?type=MATERIAL&search=${encodeURIComponent(name)}`);
    expect(listRes.status).toBe(200);
    const found = (listRes.body.data as Array<{ id: string }>).some((r) => r.id === created.id);
    expect(found).toBe(true);
  });

  it('returns presigned upload URL for material image', async () => {
    const res = await authPost(token, '/api/resources/image/upload-url', {
      filename: 'cement.jpg',
      contentType: 'image/jpeg',
    });
    if (res.status === 200) {
      expect(res.body.data.uploadUrl).toMatch(/^https?:\/\//);
      expect(res.body.data.imageUrl).toMatch(/^s3:\/\//);
    } else {
      // S3 may be unconfigured in CI — endpoint should still exist
      expect([500, 503]).toContain(res.status);
    }
  });
});
