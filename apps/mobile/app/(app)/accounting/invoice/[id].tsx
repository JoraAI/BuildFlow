/**
 * BuildFlow - Invoice Detail
 * Route: /accounting/invoice/[id]
 */
import { InvoiceDetailScreen } from '@/components/accounting/InvoiceDetailScreen';
import { DISMISS } from '@/utils/navigation';

export default function AccountingInvoiceDetailRoute() {
  return <InvoiceDetailScreen fallbackBackHref={DISMISS.accounting} />;
}
