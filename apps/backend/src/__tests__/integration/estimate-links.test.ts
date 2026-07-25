/**
 * Integration tests for estimate procurement-link integrity.
 *
 * Verifies:
 *  1. duplicateEstimate preserves resourceId, rateAnalysisId, wbsItemId
 *  2. submitForReview rejects MATERIAL items without a procurement link
 */
import { loginAs, authGet, authPost, getProjectId } from './test-helpers';

const PM = 'pm@reddyconst.com';

describe('Estimate procurement-link integrity (integration)', () => {
  let token: string;
  let projectId: string;
  let rateAnalysisId: string;
  let resourceId: string;

  beforeAll(async () => {
    token = await loginAs(PM);
    projectId = await getProjectId(token, 'GVR-C');

    // Fetch a rate analysis and resource for linking test items
    const raRes = await authGet(token, '/api/rate-analyses?limit=1');
    expect(raRes.status).toBe(200);
    const ra = raRes.body.data?.rows?.[0] ?? raRes.body.data?.[0];
    expect(ra).toBeTruthy();
    rateAnalysisId = ra.id;

    const resRes = await authGet(token, '/api/resources?type=MATERIAL&limit=1');
    expect(resRes.status).toBe(200);
    resourceId = resRes.body.data[0].id;
    expect(resourceId).toBeTruthy();
  });

  async function createEstimateWithLinkedItem(): Promise<{
    estimateId: string;
    sectionId: string;
    itemId: string;
  }> {
    const estRes = await authPost(token, `/api/projects/${projectId}/estimates`, {
      name: `Link Test ${Date.now()}`,
    });
    expect(estRes.status).toBe(201);
    const estimateId = estRes.body.data.id;

    const secRes = await authPost(
      token,
      `/api/estimates/${estimateId}/sections`,
      { name: 'Test Section', orderIndex: 1 },
    );
    expect(secRes.status).toBe(201);
    const sectionId = secRes.body.data.id;

    // Create a MATERIAL item with BOTH resourceId and rateAnalysisId
    const itemRes = await authPost(
      token,
      `/api/estimates/${estimateId}/items`,
      {
        sectionId,
        description: 'Test material with RA link',
        unit: 'cum',
        quantity: 10,
        rate: 5000,
        type: 'MATERIAL',
        resourceId,
        rateAnalysisId,
      },
    );
    expect(itemRes.status).toBe(201);
    const itemId = itemRes.body.data.id;

    return { estimateId, sectionId, itemId };
  }

  it('duplicateEstimate preserves resourceId, rateAnalysisId, wbsItemId', async () => {
    const { estimateId, itemId } = await createEstimateWithLinkedItem();

    // Duplicate the estimate
    const dupRes = await authPost(token, `/api/estimates/${estimateId}/duplicate`);
    expect(dupRes.status).toBe(200);
    const dupEstimateId = dupRes.body.data.id;

    // Fetch the duplicated estimate and verify item links survived
    const fetchRes = await authGet(token, `/api/estimates/${dupEstimateId}`);
    expect(fetchRes.status).toBe(200);

    const items = fetchRes.body.data.sections.flatMap(
      (s: { items: Array<{ resourceId: string | null; rateAnalysisId: string | null }> }) => s.items,
    );
    expect(items.length).toBeGreaterThan(0);

    const dupItem = items[0];
    expect(dupItem.resourceId).toBe(resourceId);
    expect(dupItem.rateAnalysisId).toBe(rateAnalysisId);

    // Source item should also still have links (not corrupted by duplication)
    const sourceFetch = await authGet(token, `/api/estimates/${estimateId}`);
    const sourceItem = sourceFetch.body.data.sections[0].items.find(
      (i: { id: string }) => i.id === itemId,
    );
    expect(sourceItem.resourceId).toBe(resourceId);
    expect(sourceItem.rateAnalysisId).toBe(rateAnalysisId);
  });

  it('submitForReview blocks MATERIAL items without resourceId or rateAnalysisId', async () => {
    const estRes = await authPost(token, `/api/projects/${projectId}/estimates`, {
      name: `Unlinked Test ${Date.now()}`,
    });
    expect(estRes.status).toBe(201);
    const estimateId = estRes.body.data.id;

    const secRes = await authPost(
      token,
      `/api/estimates/${estimateId}/sections`,
      { name: 'Test Section', orderIndex: 1 },
    );
    const sectionId = secRes.body.data.id;

    // Create a MATERIAL item WITHOUT any procurement link
    const itemRes = await authPost(token, `/api/estimates/${estimateId}/items`, {
      sectionId,
      description: 'Unlinked material item',
      unit: 'cum',
      quantity: 5,
      rate: 1000,
      type: 'MATERIAL',
    });
    expect(itemRes.status).toBe(201);

    // Submitting should fail with a clear error
    const submitRes = await authPost(token, `/api/estimates/${estimateId}/submit`);
    expect(submitRes.status).toBe(400);
    expect(submitRes.body.error?.message).toMatch(/not linked to a catalog material/i);
    expect(submitRes.body.error?.message).toContain('Unlinked material item');
  });

  it('submitForReview succeeds when MATERIAL items have rateAnalysisId', async () => {
    const { estimateId, sectionId } = await createEstimateWithLinkedItem();

    // Add a second linked item (RA only, no resourceId)
    const item2Res = await authPost(token, `/api/estimates/${estimateId}/items`, {
      sectionId,
      description: 'RA-linked material',
      unit: 'sqm',
      quantity: 20,
      rate: 300,
      type: 'MATERIAL',
      rateAnalysisId,
    });
    expect(item2Res.status).toBe(201);

    // Submit should succeed — both items have links
    const submitRes = await authPost(token, `/api/estimates/${estimateId}/submit`);
    expect(submitRes.status).toBe(200);
    expect(submitRes.body.data.status).toBe('REVIEWED');
  });
});