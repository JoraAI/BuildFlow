import { toMsg91Mobile } from '../../services/msg91.service';

describe('toMsg91Mobile', () => {
  it('prefixes 10-digit Indian numbers with 91', () => {
    expect(toMsg91Mobile('9876543210')).toBe('919876543210');
    expect(toMsg91Mobile('+91 98765 43210')).toBe('919876543210');
  });

  it('keeps numbers that already include 91', () => {
    expect(toMsg91Mobile('919876543210')).toBe('919876543210');
    expect(toMsg91Mobile('+919876543210')).toBe('919876543210');
  });
});
