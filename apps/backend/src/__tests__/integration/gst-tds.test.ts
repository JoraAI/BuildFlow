/**
 * GST / TDS calculation unit tests.
 */
import { calculateGST, round2 } from '../../services/gst.service';

describe('calculateGST', () => {
  it('splits CGST+SGST for intra-state (Telangana)', () => {
    const result = calculateGST({
      subtotal: 100_000,
      gstRate: 18,
      tdsEnabled: false,
      tdsRate: 2,
      companyState: 'Telangana',
      clientState: 'Telangana',
    });
    expect(result.isIntraState).toBe(true);
    expect(result.cgstAmount).toBe(9000);
    expect(result.sgstAmount).toBe(9000);
    expect(result.igstAmount).toBe(0);
    expect(result.netPayable).toBe(118_000);
  });

  it('applies IGST for inter-state', () => {
    const result = calculateGST({
      subtotal: 50_000,
      gstRate: 18,
      tdsEnabled: false,
      tdsRate: 2,
      companyState: 'Telangana',
      clientState: 'Maharashtra',
    });
    expect(result.isIntraState).toBe(false);
    expect(result.igstAmount).toBe(9000);
    expect(result.cgstAmount).toBe(0);
    expect(result.netPayable).toBe(59_000);
  });

  it('deducts TDS 194C when enabled', () => {
    const result = calculateGST({
      subtotal: 100_000,
      gstRate: 18,
      tdsEnabled: true,
      tdsRate: 2,
      companyState: 'Telangana',
      clientState: 'Telangana',
    });
    expect(result.tdsAmount).toBe(2000);
    expect(result.netPayable).toBe(round2(118_000 - 2000));
  });

  it('defaults to IGST when client state missing', () => {
    const result = calculateGST({
      subtotal: 10_000,
      gstRate: 18,
      tdsEnabled: false,
      tdsRate: 2,
      companyState: 'Telangana',
    });
    expect(result.igstAmount).toBe(1800);
    expect(result.isIntraState).toBe(false);
  });
});
