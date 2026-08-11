/**
 * BuildFlow - Bill Detail
 * Route: /accounting/bill/[id]
 */
import { BillDetailScreen } from '@/components/accounting/BillDetailScreen';
import { DISMISS } from '@/utils/navigation';

export default function AccountingBillDetailRoute() {
  return <BillDetailScreen fallbackBackHref={DISMISS.accounting} />;
}
