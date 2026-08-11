/**
 * Inventory shell - Sales invoice detail.
 * Route: /inventory/invoices/[id]
 */
import { InvoiceDetailScreen } from '@/components/accounting/InvoiceDetailScreen';

export default function InventoryInvoiceDetailRoute() {
  return <InvoiceDetailScreen fallbackBackHref="/inventory/invoices" />;
}
