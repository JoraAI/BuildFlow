/**
 * PROCUREMENT_PICKER_PERF - unit tests for the shared procurement picker
 * eligibility helpers (no DB required).
 */
import {
  isPoFullyReceived,
  indentAvailableForNewPo,
  poAvailableForNewGrn,
  poRemainingByResource,
} from '@buildflow/shared';

const PO = (overrides: Record<string, unknown> = {}) => ({
  id: 'po-1',
  poNumber: 'PO-1',
  status: 'APPROVED',
  vendorName: 'Vendor',
  lines: [
    { id: 'l1', resourceId: 'r-cement', quantity: 10, unit: 'bag', rate: '400', resource: { id: 'r-cement', name: 'Cement', unit: 'bag' } },
  ],
  goodsReceipts: [],
  ...overrides,
});

describe('procurement picker eligibility (shared)', () => {
  it('indent is eligible for New PO only when APPROVED with zero POs', () => {
    expect(indentAvailableForNewPo({ status: 'APPROVED', purchaseOrders: [] })).toBe(true);
    expect(indentAvailableForNewPo({ status: 'APPROVED' })).toBe(true);
    expect(indentAvailableForNewPo({ status: 'SUBMITTED', purchaseOrders: [] })).toBe(false);
    expect(indentAvailableForNewPo({ status: 'DRAFT', purchaseOrders: [] })).toBe(false);
    expect(indentAvailableForNewPo({ status: 'APPROVED', purchaseOrders: [{ id: 'po-x' }] })).toBe(false);
  });

  it('PO with partial GRN is still eligible for New GRN', () => {
    const po = PO({
      goodsReceipts: [{ id: 'g1', grnNumber: 'GRN-1', receivedDate: '2026-01-01', lines: [{ resourceId: 'r-cement', quantity: 4, unit: 'bag' }] }],
    });
    expect(poAvailableForNewGrn(po)).toBe(true);
    expect(isPoFullyReceived(po)).toBe(false);
  });

  it('remaining qty equals PO qty minus receipts', () => {
    const po = PO({
      goodsReceipts: [{ id: 'g1', grnNumber: 'GRN-1', receivedDate: '2026-01-01', lines: [{ resourceId: 'r-cement', quantity: 4, unit: 'bag' }] }],
    });
    const remaining = poRemainingByResource(po);
    expect(remaining.get('r-cement')).toBe(6);
  });

  it('fully received PO is hidden from New GRN and floats are tolerated', () => {
    const po = PO({
      goodsReceipts: [
        { id: 'g1', grnNumber: 'GRN-1', receivedDate: '2026-01-01', lines: [{ resourceId: 'r-cement', quantity: 5.0004, unit: 'bag' }] },
        { id: 'g2', grnNumber: 'GRN-2', receivedDate: '2026-01-02', lines: [{ resourceId: 'r-cement', quantity: 4.9996, unit: 'bag' }] },
      ],
    });
    expect(isPoFullyReceived(po)).toBe(true);
    expect(poAvailableForNewGrn(po)).toBe(false);
  });

  it('cancelled PO is never eligible for New GRN even with remaining qty', () => {
    const po = PO({ status: 'CANCELLED' });
    expect(poAvailableForNewGrn(po)).toBe(false);
  });
});
