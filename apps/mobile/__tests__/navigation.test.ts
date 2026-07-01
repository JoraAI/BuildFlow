/**
 * Navigation utility unit tests.
 */
import {
  parseReturnTo,
  withReturnTo,
  projectTabHref,
  billDetailHref,
  invoiceDetailHref,
} from '@/utils/navigation-paths';

describe('parseReturnTo', () => {
  it('decodes encoded returnTo param', () => {
    const encoded = encodeURIComponent('/projects/abc?tab=subcontracts');
    expect(parseReturnTo(encoded)).toBe('/projects/abc?tab=subcontracts');
  });

  it('returns null for missing param', () => {
    expect(parseReturnTo(undefined)).toBeNull();
  });

  it('handles array param', () => {
    expect(parseReturnTo(['/projects/x?tab=boq'])).toBe('/projects/x?tab=boq');
  });
});

describe('withReturnTo', () => {
  it('appends returnTo query', () => {
    expect(withReturnTo('/accounting/bill/1', '/projects/p?tab=subcontracts')).toBe(
      '/accounting/bill/1?returnTo=%2Fprojects%2Fp%3Ftab%3Dsubcontracts',
    );
  });

  it('uses ampersand when href already has query', () => {
    const href = withReturnTo('/foo?x=1', '/bar');
    expect(href).toContain('&returnTo=');
  });
});

describe('href helpers', () => {
  it('builds project tab href', () => {
    expect(projectTabHref('pid', 'procurement')).toBe('/projects/pid?tab=procurement');
  });

  it('builds bill detail with returnTo', () => {
    const href = billDetailHref('bid', '/projects/p?tab=subcontracts');
    expect(href).toContain('/accounting/bill/bid');
    expect(href).toContain('returnTo=');
  });

  it('builds invoice detail with returnTo', () => {
    expect(invoiceDetailHref('iid', '/projects/p')).toContain('/accounting/invoice/iid');
  });
});
