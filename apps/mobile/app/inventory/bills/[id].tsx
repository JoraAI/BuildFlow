/**
 * Inventory shell - Vendor bill detail.
 * Route: /inventory/bills/[id]
 */
import { BillDetailScreen } from '@/components/accounting/BillDetailScreen';

export default function InventoryBillDetailRoute() {
  return <BillDetailScreen fallbackBackHref="/inventory/bills" inventoryMode />;
}
