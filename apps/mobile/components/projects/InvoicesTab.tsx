/**
 * Project client invoices (incl. RA bills) — reachable from the project, not only Accounting.
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Badge, Button, EmptyState, LoadingSkeleton } from '@/components/ui';
import { useAuthStore } from '@/stores/auth.store';
import { useInvoices, type Invoice } from '@/services/accounting.queries';
import { formatINR, formatDate } from '@/utils/format';
import { invoiceDetailHref, projectTabHref } from '@/utils/navigation';

const INVOICE_STATUS_COLOR: Record<string, 'success' | 'warning' | 'danger' | 'primary' | 'neutral'> = {
  DRAFT: 'neutral',
  SENT: 'primary',
  PAID: 'success',
  OVERDUE: 'danger',
};

export function InvoicesTab({ projectId }: { projectId: string }) {
  const router = useRouter();
  const perms = useAuthStore((s) => s.user?.permissions);
  const role = useAuthStore((s) => s.user?.role);
  const canView =
    role === 'OWNER' || !perms || perms.includes('invoice.view');
  const canCreate =
    role === 'OWNER' || role === 'PM' || role === 'ACCOUNTANT' || perms?.includes('invoice.create');
  const { data: invoices, isLoading } = useInvoices(projectId);
  const returnTo = projectTabHref(projectId, 'invoices');

  if (!canView) {
    return (
      <EmptyState
        title="No access"
        description="You need invoice.view permission to see client / RA bills for this project."
      />
    );
  }

  if (isLoading) return <LoadingSkeleton className="h-48 rounded-xl" />;

  const list: Invoice[] = invoices ?? [];
  const raCount = list.filter((i: Invoice) => i.invoiceType === 'RUNNING_ACCOUNT').length;
  const outstanding = list
    .filter((i: Invoice) => i.status !== 'PAID' && i.status !== 'DRAFT')
    .reduce(
      (s: number, i: Invoice) => s + Math.max(0, Number(i.total) - Number(i.paidAmount ?? 0)),
      0,
    );

  if (list.length === 0) {
    return (
      <EmptyState
        title="No client invoices yet"
        description="Create a standard or Running Account (RA) invoice to bill the client against executed BOQ."
        action={
          canCreate ? (
            <Button
              label="New Invoice / RA"
              onPress={() =>
                router.push(
                  `/accounting/create-invoice?projectId=${projectId}&returnTo=${encodeURIComponent(returnTo)}` as never,
                )
              }
            />
          ) : undefined
        }
      />
    );
  }

  return (
    <View className="gap-3">
      <View className="flex-row gap-2 flex-wrap items-center justify-between">
        <View className="flex-row gap-2 flex-1">
          <View className="flex-1 bg-card rounded-xl border border-border p-3 min-w-[120px]">
            <Text className="text-xs text-muted mb-1">Outstanding</Text>
            <Text className="text-base font-bold text-text">{formatINR(outstanding)}</Text>
          </View>
          <View className="flex-1 bg-card rounded-xl border border-border p-3 min-w-[120px]">
            <Text className="text-xs text-muted mb-1">RA bills</Text>
            <Text className="text-base font-bold text-text">{raCount}</Text>
          </View>
        </View>
        {canCreate ? (
          <Button
            label="New Invoice / RA"
            size="sm"
            onPress={() =>
              router.push(
                `/accounting/create-invoice?projectId=${projectId}&returnTo=${encodeURIComponent(returnTo)}` as never,
              )
            }
          />
        ) : null}
      </View>

      {list.map((inv: Invoice) => (
        <Pressable
          key={inv.id}
          onPress={() => router.push(invoiceDetailHref(inv.id, returnTo) as never)}
        >
          <Card>
            <View className="flex-row justify-between items-start gap-2">
              <View className="flex-1">
                <Text className="text-sm font-semibold text-text">{inv.invoiceNumber}</Text>
                <Text className="text-xs text-muted mt-0.5">
                  {inv.clientName} · {formatDate(inv.invoiceDate)}
                  {inv.invoiceType === 'RUNNING_ACCOUNT'
                    ? ` · RA #${inv.raSequence ?? '—'}`
                    : ''}
                </Text>
              </View>
              <Badge
                label={inv.status}
                color={INVOICE_STATUS_COLOR[inv.status] ?? 'neutral'}
              />
            </View>
            <View className="flex-row justify-between items-center mt-2 pt-2 border-t border-border">
              <Text className="text-xs text-muted">
                {inv.invoiceType === 'RUNNING_ACCOUNT' ? 'Running Account' : 'Standard'}
              </Text>
              <Text className="text-base font-bold text-primary">{formatINR(Number(inv.total))}</Text>
            </View>
          </Card>
        </Pressable>
      ))}
    </View>
  );
}
