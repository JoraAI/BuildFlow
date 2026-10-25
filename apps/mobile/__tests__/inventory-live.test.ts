import { QueryClient } from '@tanstack/react-query';
import { invalidateInventoryLive } from '../lib/inventory-live';

describe('invalidateInventoryLive', () => {
  it('marks stock, notifications, and sales queries stale', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(['notifications', 'unread-count'], { items: [], unreadCount: 0 });
    qc.setQueryData(['procurement', 'stock', 'summary', 'p1', 'all'], []);
    qc.setQueryData(['transactions', 'sales-orders'], []);
    invalidateInventoryLive(qc);
    await Promise.resolve();
    expect(qc.getQueryState(['notifications', 'unread-count'])?.isInvalidated).toBe(true);
    expect(qc.getQueryState(['procurement', 'stock', 'summary', 'p1', 'all'])?.isInvalidated).toBe(
      true,
    );
    expect(qc.getQueryState(['transactions', 'sales-orders'])?.isInvalidated).toBe(true);
  });
});
