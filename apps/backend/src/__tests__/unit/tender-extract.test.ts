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

import { extractTenderItems } from '../../services/tender-extract.service';

const COMPANY = '00000000-0000-0000-0000-000000000001';

describe('tender-extract service', () => {
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

    // Notes pass through from the LLM
    expect(result.notes).toContain('Two valid items');
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