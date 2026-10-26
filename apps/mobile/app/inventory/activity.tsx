/**
 * Inventory user activity — company audit trail (Settings audit API).
 */
import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { Card, Badge, Button, Input, LoadingSkeleton, EmptyState, Select } from '@/components/ui';
import {
  useInventoryActivity,
  useInventoryActivityPeople,
  auditActorName,
  auditSummary,
  prettyEntityType,
  type AuditLogFilters,
  type AuditLogRow,
} from '@/services/settings.queries';
import { mobileListBottomPadding } from '@/components/layout/fab-layout';
import { useViewport } from '@/hooks/useViewport';

const ACTION_COLOR: Record<string, 'success' | 'warning' | 'danger' | 'primary' | 'accent' | 'neutral'> = {
  CREATE: 'success',
  UPDATE: 'primary',
  DELETE: 'danger',
  APPROVE: 'success',
  REJECT: 'danger',
  SEND: 'accent',
  CUSTOM: 'neutral',
};

const ACTION_OPTIONS = [
  { title: 'All actions', value: '' },
  { title: 'Create', value: 'CREATE' },
  { title: 'Update', value: 'UPDATE' },
  { title: 'Delete', value: 'DELETE' },
  { title: 'Approve', value: 'APPROVE' },
  { title: 'Submit', value: 'SUBMIT' },
  { title: 'Send', value: 'SEND' },
  { title: 'Other', value: 'CUSTOM' },
];

const ENTITY_OPTIONS = [
  { title: 'All types', value: '' },
  { title: 'Cash book entry', value: 'cash_book_entry' },
  { title: 'Cash book category', value: 'cash_book_category' },
  { title: 'Invoice', value: 'Invoice' },
  { title: 'Bill', value: 'Bill' },
  { title: 'Purchase request', value: 'MaterialRequisition' },
  { title: 'Purchase order', value: 'PurchaseOrder' },
  { title: 'Stock movement', value: 'StockMovement' },
  { title: 'Company', value: 'Company' },
  { title: 'User', value: 'User' },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function InventoryActivityScreen() {
  const { isPhone, isDesktop } = useViewport();
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [userId, setUserId] = useState('');
  const limit = 40;
  const filters = useMemo<AuditLogFilters>(
    () => ({
      q: query.trim() || undefined,
      action: action || undefined,
      entityType: entityType || undefined,
      userId: userId || undefined,
    }),
    [query, action, entityType, userId],
  );
  const { data, isLoading, isError, refetch, isFetching } = useInventoryActivity(page, limit, filters);
  const { data: users } = useInventoryActivityPeople();
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const totalPages = data?.meta.totalPages ?? 1;
  const filtersActive = Boolean(filters.q || filters.action || filters.entityType || filters.userId);

  const personOptions = useMemo(
    () => [
      { title: 'Anyone', value: '' },
      ...(users ?? []).map((u: { id: string; name: string }) => ({ title: u.name, value: u.id })),
    ],
    [users],
  );

  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerStyle={{
        padding: isDesktop ? 24 : 16,
        paddingBottom: isPhone ? mobileListBottomPadding() + 24 : 48,
        maxWidth: isDesktop ? 900 : undefined,
        width: '100%',
        alignSelf: 'center',
      }}
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={() => void refetch()} />}
    >
      <Text className="text-2xl font-bold text-text mb-1">User activity</Text>
      <Text className="text-sm text-muted mb-4">{total} events · company audit trail</Text>

      <View className="gap-2 mb-4">
        <Input
          label="Search"
          value={query}
          onChangeText={(v) => {
            setQuery(v);
            setPage(1);
          }}
          placeholder="Person, type, or id…"
          compact
          fullWidth
        />
        <View className={isPhone ? 'gap-2' : 'flex-row flex-wrap items-end gap-2'}>
          <View className={isPhone ? 'w-full' : 'w-40'}>
            <Select
              label="Action"
              value={action}
              onChange={(v) => {
                setAction(v ?? '');
                setPage(1);
              }}
              compact={!isPhone}
              options={ACTION_OPTIONS}
            />
          </View>
          <View className={isPhone ? 'w-full' : 'w-52'}>
            <Select
              label="Type"
              value={entityType}
              onChange={(v) => {
                setEntityType(v ?? '');
                setPage(1);
              }}
              compact={!isPhone}
              options={ENTITY_OPTIONS}
            />
          </View>
          {personOptions.length > 1 ? (
            <View className={isPhone ? 'w-full' : 'w-52'}>
              <Select
                label="Changed by"
                value={userId}
                onChange={(v) => {
                  setUserId(v ?? '');
                  setPage(1);
                }}
                compact={!isPhone}
                options={personOptions}
              />
            </View>
          ) : null}
        </View>
        {filtersActive ? (
          <Button
            label="Clear filters"
            size="sm"
            variant="ghost"
            onPress={() => {
              setQuery('');
              setAction('');
              setEntityType('');
              setUserId('');
              setPage(1);
            }}
          />
        ) : null}
      </View>

      {isLoading ? (
        <View className="gap-3">
          {[1, 2, 3, 4].map((i) => (
            <LoadingSkeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </View>
      ) : isError ? (
        <EmptyState
          title="Could not load activity"
          description="Check your connection and try again."
          action={<Button label="Retry" onPress={() => void refetch()} />}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title={filtersActive ? 'No matching activity' : 'No activity yet'}
          description={
            filtersActive
              ? 'Try a different person, type, or search.'
              : 'Stock, sales, cash book, and settings changes will appear here.'
          }
        />
      ) : (
        <View className="gap-2">
          {rows.map((r: AuditLogRow) => {
            const actor = auditActorName(r);
            return (
              <Card key={r.id} className="p-3">
                <TouchableOpacity onPress={() => setExpanded(expanded === r.id ? null : r.id)}>
                  <View className="flex-row items-center justify-between gap-2">
                    <View className="flex-1 min-w-0">
                      <View className="flex-row items-center flex-wrap gap-2 mb-1">
                        <Badge label={r.action} color={ACTION_COLOR[r.action] ?? 'neutral'} />
                        <Text className="text-xs text-muted">{prettyEntityType(r.entityType)}</Text>
                      </View>
                      <Text className="text-sm text-text" numberOfLines={2}>
                        {auditSummary(r)}
                      </Text>
                      <Text className="text-xs text-muted mt-1">
                        Changed by {actor} · {formatDate(r.createdAt)}
                      </Text>
                    </View>
                    <Text className="text-primary text-xl">{expanded === r.id ? '▾' : '›'}</Text>
                  </View>
                </TouchableOpacity>
                {expanded === r.id ? (
                  <View className="mt-3 pt-3 border-t border-border">
                    <Text className="text-xs text-muted mb-1">By {actor}</Text>
                    {r.oldValue != null ? (
                      <Text className="text-[11px] text-muted mb-1" numberOfLines={4}>
                        Old: {JSON.stringify(r.oldValue)}
                      </Text>
                    ) : null}
                    <Text className="text-[11px] text-muted" numberOfLines={6}>
                      New: {JSON.stringify(r.newValue)}
                    </Text>
                  </View>
                ) : null}
              </Card>
            );
          })}
          {totalPages > 1 ? (
            <View className="flex-row justify-between items-center mt-4">
              <Button
                label="‹ Prev"
                variant="ghost"
                onPress={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              />
              <Text className="text-sm text-muted">
                Page {page} of {totalPages}
              </Text>
              <Button
                label="Next ›"
                variant="ghost"
                onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              />
            </View>
          ) : null}
        </View>
      )}
    </ScrollView>
  );
}
