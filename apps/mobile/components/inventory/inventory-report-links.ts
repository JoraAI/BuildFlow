import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

export type InventoryReportView = 'health' | 'warehouse' | 'margin' | 'purchase' | 'pnl';
export type InventoryExcelReport = 'pnl' | 'margin' | 'stock-health' | 'expenses';

export type InventoryReportLink = {
  view: InventoryReportView;
  title: string;
  subtitle: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  excel?: InventoryExcelReport;
};

export const INVENTORY_REPORT_LINKS: readonly InventoryReportLink[] = [
  {
    view: 'health',
    title: 'Stock health',
    subtitle: 'Active, slow, and dead stock',
    icon: 'pulse-outline',
    excel: 'stock-health',
  },
  {
    view: 'warehouse',
    title: 'Warehouse value',
    subtitle: 'On-hand value by location',
    icon: 'business-outline',
  },
  {
    view: 'margin',
    title: 'Margins',
    subtitle: 'Revenue minus cost of goods',
    icon: 'trending-up-outline',
    excel: 'margin',
  },
  {
    view: 'purchase',
    title: 'Purchase history',
    subtitle: 'Last buy rate vs current WAC',
    icon: 'bag-outline',
  },
  {
    view: 'pnl',
    title: 'Profit & loss',
    subtitle: 'Sales, COGS, expenses, profit',
    icon: 'stats-chart-outline',
    excel: 'pnl',
  },
];

export function isInventoryReportView(value: string | undefined): value is InventoryReportView {
  return INVENTORY_REPORT_LINKS.some((link) => link.view === value);
}
