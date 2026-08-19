/**
 * Navigation utility unit tests.
 */
import {
  parseReturnTo,
  withReturnTo,
  projectTabHref,
  billDetailHref,
  invoiceDetailHref,
  inventoryBillDetailHref,
  inventoryInvoiceDetailHref,
  inventoryStockItemHref,
  createEstimateHref,
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

  it('builds inventory bill/invoice detail under /inventory', () => {
    expect(inventoryBillDetailHref('bid', '/inventory/bills')).toContain('/inventory/bills/bid');
    expect(inventoryInvoiceDetailHref('iid', '/inventory/invoices')).toContain(
      '/inventory/invoices/iid',
    );
  });

  it('builds inventory stock item href', () => {
    expect(inventoryStockItemHref('rid')).toBe('/inventory/stock/rid');
    expect(inventoryStockItemHref('rid', 'loc1')).toBe('/inventory/stock/rid?locationId=loc1');
  });

  it('builds a unique estimate create href so the wizard remounts', () => {
    const href = createEstimateHref({
      projectId: 'proj-1',
      fromProposal: 'prop-2',
    });
    expect(href).toContain('/(app)/estimation/create?');
    expect(href).toContain('projectId=proj-1');
    expect(href).toContain('fromProposal=prop-2');
    expect(href).toContain('reset=');
    expect(href).not.toContain('estimateId=');
  });

  it('includes estimateId when editing', () => {
    const href = createEstimateHref({
      projectId: 'proj-1',
      estimateId: 'est-9',
    });
    expect(href).toContain('estimateId=est-9');
  });
});
