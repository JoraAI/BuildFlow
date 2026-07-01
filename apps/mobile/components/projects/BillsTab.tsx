/**
 * BuildFlow - Project Bills Tab
 * Shows vendor bills scoped to a project, with a "New Bill" action.
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Badge, Button, EmptyState, LoadingSkeleton } from '@/components/ui';
import { useAuthStore } from '@/stores/auth.store';
import { useBills, type Bill } from '@/services/accounting.queries';
import { formatINR, formatDate } from '@/utils/format';
import { billDetailHref, projectTabHref } from '@/utils/navigation';

const BILL_STATUS_COLOR: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  PAID: 'neutral',
  REJECTED: 'danger',
};

const BILL_CATEGORY_COLOR: Record<string, 'primary' | 'warning' | 'success' | 'danger' | 'neutral'> = {
  MATERIAL: 'primary',
  LABOUR: 'success',
  EQUIPMENT: 'warning',
  SUBCONTRACTOR: 'danger',
  OTHER: 'neutral',
};

export function BillsTab({ projectId }: { projectId: string }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const canCreate = user?.role === 'OWNER' || user?.role === 'PM' || user?.role === 'ACCOUNTANT';
  const { data: bills, isLoading } = useBills(projectId);

  const returnTo = projectTabHref(projectId, 'bills');

  if (isLoading) return <LoadingSkeleton className="h-48 rounded-xl" />;

  const list = bills ?? [];

  if (list.length === 0) {
    return (
      <EmptyState
        title="No bills yet"
        description="Add a vendor bill to track project costs. Bills approved here update the Committed spend on Overview."
        action={
          canCreate ? (
            <Button
              label="New Bill"
              onPress={() =>
                router.push(
                  `/accounting/create-bill?projectId=${projectId}&returnTo=${encodeURIComponent(returnTo)}` as never,
                )
              }
            />
          ) : undefined
        }
      />
    );
  }

  const totalCommitted = list
    .filter((b: Bill) => b.status === 'APPROVED' || b.status === 'PAID')
    .reduce((s: number, b: Bill) => s + b.total, 0);
  const totalPaid = list
    .filter((b: Bill) => b.status === 'APPROVED' || b.status === 'PAID')
    .reduce((s: number, b: Bill) => s + b.paidAmount, 0);

  return (
    <View className="gap-3">
      {/* Summary strip */}
      <View className="flex-row gap-2">
        <View className="flex-1 bg-card rounded-xl border border-border p-3">
          <Text className="text-xs text-muted mb-1">Committed</Text>
          <Text className="text-base font-bold text-text">{formatINR(totalCommitted)}</Text>
        </View>
        <View className="flex-1 bg-card rounded-xl border border-border p-3">
          <Text className="text-xs text-muted mb-1">Paid out</Text>
          <Text className="text-base font-bold text-success">{formatINR(totalPaid)}</Text>
        </View>
      </View>

      <View className="flex-row justify-between items-center">
        <Text className="text-sm font-bold text-text">{list.length} Bills</Text>
        {canCreate && (
          <Button
            label="New Bill"
            size="sm"
            onPress={() =>
              router.push(
                `/accounting/create-bill?projectId=${projectId}&returnTo=${encodeURIComponent(returnTo)}` as never,
              )
            }
          />
        )}
      </View>

      {list.map((bill: Bill) => {
        const statusColor = BILL_STATUS_COLOR[bill.status] ?? 'neutral';
        const catColor = BILL_CATEGORY_COLOR[bill.category] ?? 'neutral';
        return (
          <Card key={bill.id} onPress={() => router.push(billDetailHref(bill.id, returnTo) as never)}>
            <View className="flex-row justify-between items-start mb-2">
              <View className="flex-1 mr-2">
                <Text className="text-sm font-mono font-semibold text-text">{bill.billNumber}</Text>
                <Text className="text-xs text-muted">{bill.vendorName}</Text>
              </View>
              <View className="flex-row gap-1">
                <Badge color={catColor} label={bill.category} />
                <Badge color={statusColor} label={bill.status} />
              </View>
            </View>
            <View className="flex-row justify-between items-end">
              <View>
                <Text className="text-xs text-muted">Net payable</Text>
                <Text className="text-base font-bold text-text">{formatINR(bill.total)}</Text>
              </View>
              {bill.paidAmount > 0 && (
                <View className="items-end">
                  <Text className="text-xs text-muted">Paid</Text>
                  <Text className="text-sm font-semibold text-success">{formatINR(bill.paidAmount)}</Text>
                </View>
              )}
              <Text className="text-xs text-muted">{formatDate(bill.billDate)}</Text>
            </View>
          </Card>
        );
      })}
    </View>
  );
}