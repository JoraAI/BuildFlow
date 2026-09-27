/**
 * Unit tests for the tender-extract service.
 *
 * Mocks `callLlmForExtraction` to avoid hitting a real LLM and asserts the
 * pipeline: text → JSON parse → normalize → soft-match.
 */
import { tenderExtractionResultSchema } from '@buildflow/shared';

// Mock prisma so softMatchResource/softMatchRateAnalysis don't hit the DB.
jest.mock('../../lib/prisma', () => ({
  prisma: {
    resource: {
      findMany: jest.fn().mockResolvedValue([]), // no resource match → resourceId null
    },
    rateAnalysis: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  },
}));

// Mock resolveLlmConfig so callLlmForExtraction uses our canned response.
jest.mock('../../services/integration.service', () => ({
  resolveLlmConfig: jest.fn().mockResolvedValue({
    apiUrl: 'http://mock',
    apiKey: 'mock-key',
    model: 'mock-model',
  }),
}));

// Stub global fetch to return our canned LLM JSON.
const mockLlmResponse = JSON.stringify({
  items: [
    { description: 'OPC 53 Cement', unit: 'bag', quantity: 500, rate: 350, type: 'MATERIAL', section: 'Substructure' },
    { description: 'RCC M25 footing', unit: 'cum', quantity: 120, rate: 7800, type: 'MISC', section: 'Substructure' },
    { description: '  ', unit: '', quantity: -5, rate: 'bad', type: 'INVALID' }, // should be dropped
  ],
  notes: 'Two valid items extracted',
});

(globalThis as { fetch?: unknown }).fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({
    choices: [{ message: { content: mockLlmResponse } }],
  }),
});

import { extractTenderItems, tokenSimilarity } from '../../services/tender-extract.service';
import { prisma } from '../../lib/prisma';

const COMPANY = '00000000-0000-0000-0000-000000000001';

describe('tender-extract service', () => {
  it('tokenSimilarity scores different wording for the same work', () => {
    expect(
      tokenSimilarity(
        'Earthwork excavation in ordinary soil',
        'Excavation in Ordinary Soil',
      ),
    ).toBeGreaterThan(0.5);
    expect(tokenSimilarity('RCC M30 slab', 'RCC M30')).toBeGreaterThan(0.4);
    expect(tokenSimilarity('Cement bags', 'Granite flooring')).toBeLessThan(0.2);
  });

  it('fuzzy-matches catalog when LLM leaves match fields null', async () => {
    (prisma.resource.findMany as jest.Mock).mockResolvedValueOnce([
      { id: '11111111-1111-1111-1111-111111111111', name: 'OPC 53 Grade Cement', rate: 380 },
    ]);
    (prisma.rateAnalysis.findMany as jest.Mock).mockResolvedValueOnce([
      { id: '22222222-2222-2222-2222-222222222222', name: 'RCC M25', totalRate: 7500 },
    ]);

    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                items: [
                  {
                    description: 'Providing and laying RCC M25 for footing',
                    unit: 'cum',
                    quantity: 10,
                    rate: 0,
                    type: 'MISC',
                    matchedRateAnalysisName: null,
                    matchedResourceName: null,
                  },
                ],
              }),
            },
          },
        ],
      }),
    });

    const result = await extractTenderItems(COMPANY, {
      fileContent: Buffer.from('RCC M25 footing 10 cum', 'utf8').toString('base64'),
      filename: 't.txt',
      contentType: 'text/plain',
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.rateAnalysisId).toBe('22222222-2222-2222-2222-222222222222');
    expect(result.items[0]!.matchKind).toBe('RATE_ANALYSIS');
    expect(result.items[0]!.matchLabel).toBe('RCC M25');
    expect(result.items[0]!.suggestedAction).toMatch(/LINKED|REVIEW/);
    // Zero tender rate adopts library rate
    expect(result.items[0]!.rate).toBe(7500);
  });
  it('extracts and normalizes items from a plain-text "tender"', async () => {
    const fileContent = Buffer.from(
      'BOQ:\nOPC 53 Cement 500 bags @350\nRCC M25 footing 120 cum @7800',
      'utf8',
    ).toString('base64');

    const result = await extractTenderItems(COMPANY, {
      fileContent,
      filename: 'tender.txt',
      contentType: 'text/plain',
    });

    // Validate against the Zod schema (catches structural regressions)
    const parsed = tenderExtractionResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);

    // Two valid items (the malformed third row is dropped by normalizeItem)
    expect(result.items).toHaveLength(2);
    expect(result.items[0]!.description).toBe('OPC 53 Cement');
    expect(result.items[0]!.quantity).toBe(500);
    expect(result.items[0]!.type).toBe('MATERIAL');
    expect(result.items[1]!.description).toBe('RCC M25 footing');
    expect(result.items[1]!.amount).toBe(120 * 7800);

    // Notes from LLM plus auto match summary
    expect(result.notes).toContain('Two valid items');
    expect(result.notes).toContain('Confirm before finalizing');
    expect(result.items[0]!.suggestedAction).toBe('CREATE');
    expect(result.sourceTextLength).toBeGreaterThan(0);
  });

  it('reports "AI not configured" when resolveLlmConfig returns null', async () => {
    const { resolveLlmConfig } = require('../../services/integration.service') as {
      resolveLlmConfig: jest.Mock;
    };
    resolveLlmConfig.mockResolvedValueOnce(null);

    const fileContent = Buffer.from('dummy text', 'utf8').toString('base64');
    const result = await extractTenderItems(COMPANY, {
      fileContent,
      filename: 't.pdf',
      contentType: 'application/pdf',
    });

    expect(result.items).toHaveLength(0);
    expect(result.notes).toMatch(/not configured/i);
  });

  it('returns empty items when the file has no extractable text', async () => {
    const result = await extractTenderItems(COMPANY, {
      fileContent: Buffer.from('   ', 'utf8').toString('base64'),
      filename: 'empty.txt',
      contentType: 'text/plain',
    });

    expect(result.items).toHaveLength(0);
    expect(result.notes).toMatch(/No extractable text/i);
    expect(result.sourceTextLength).toBe(0);
  });
});