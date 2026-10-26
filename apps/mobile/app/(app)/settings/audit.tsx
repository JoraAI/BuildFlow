/**
 * BuildFlow - Audit Log screen.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Card, Badge, Button, Input, LoadingSkeleton, EmptyState, Select } from '@/components/ui';
import { SettingsPageLayout } from '@/components/layout/SettingsPageLayout';
import { ResponsiveGrid } from '@/components/layout/ResponsiveGrid';
import {
  useAuditLog,
  useUsers,
  auditActorName,
  auditSummary,
  prettyEntityType,
  type AuditLogFilters,
  type AuditLogRow,
} from '@/services/settings.queries';

const ACTION_COLOR: Record<string, 'success' | 'warning' | 'danger' | 'primary' | 'accent' | 'neutral'> = {
  CREATE: 'success',
  UPDATE: 'primary',
  DELETE: 'danger',
  APPROVE: 'success',
  REJECT: 'danger',
  SEND: 'accent',
  CUSTOM: 'neutral',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AuditLogScreen() {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [userId, setUserId] = useState('');
  const limit = 50;
  const filters = useMemo<AuditLogFilters>(
    () => ({
      q: query.trim() || undefined,
      action: action || undefined,
      entityType: entityType || undefined,
      userId: userId || undefined,
    }),
    [query, action, entityType, userId],
  );
  const { data, isLoading, isError, refetch, isFetching } = useAuditLog(page, limit, filters);
  const { data: users } = useUsers();
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const totalPages = data?.meta.totalPages ?? 1;
  const filtersActive = Boolean(filters.q || filters.action || filters.entityType || filters.userId);
  const personOptions = [
    { title: 'Anyone', value: '' },
    ...(users ?? []).map((u: { id: string; name: string }) => ({ title: u.name, value: u.id })),
  ];

  const filterBar = (
    <View className="gap-2 mb-4">
      <Input
        label="Search"
        value={query}
        onChangeText={(v) => {
          setQuery(v);
          setPage(1);
        }}
        placeholder="Person, type, or id…"
      />
      <View className="flex-row flex-wrap gap-2">
        <View className="w-40">
          <Select
            label="Action"
            value={action}
            onChange={(v) => {
              setAction(v ?? '');
              setPage(1);
            }}
            options={[
              { title: 'All actions', value: '' },
              { title: 'Create', value: 'CREATE' },
              { title: 'Update', value: 'UPDATE' },
              { title: 'Delete', value: 'DELETE' },
              { title: 'Approve', value: 'APPROVE' },
              { title: 'Send', value: 'SEND' },
              { title: 'Other', value: 'CUSTOM' },
            ]}
          />
        </View>
        <View className="w-52">
          <Select
            label="Type"
            value={entityType}
            onChange={(v) => {
              setEntityType(v ?? '');
              setPage(1);
            }}
            options={[
              { title: 'All types', value: '' },
              { title: 'Cash book entry', value: 'cash_book_entry' },
              { title: 'Cash book category', value: 'cash_book_category' },
              { title: 'Invoice', value: 'Invoice' },
              { title: 'Bill', value: 'Bill' },
              { title: 'Company', value: 'Company' },
              { title: 'User', value: 'User' },
            ]}
          />
        </View>
        {personOptions.length > 1 ? (
          <View className="w-52">
            <Select
              label="Changed by"
              value={userId}
              onChange={(v) => {
                setUserId(v ?? '');
                setPage(1);
              }}
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
  );

  const content = isLoading ? (
    <View className="gap-3">
      {[...Array(5)].map((_, i) => (
        <LoadingSkeleton key={i} className="h-20" />
      ))}
    </View>
  ) : isError ? (
    <EmptyState
      title="Could not load audit log"
      description="Check your connection and try again."
      action={<Button label="Retry" onPress={() => refetch()} />}
    />
  ) : rows.length === 0 ? (
    <EmptyState
      title={filtersActive ? 'No matching activity' : 'No activity yet'}
      description={filtersActive ? 'Try a different person, type, or search.' : 'Mutations will appear here.'}
    />
  ) : (
    <>
      <ResponsiveGrid gap={12}>
        {rows.map((r: AuditLogRow) => (
          <Card key={r.id} className="h-full mb-0">
            <TouchableOpacity
              onPress={() => setExpanded(expanded === r.id ? null : r.id)}
              className="flex-row items-center justify-between"
            >
              <View className="flex-1">
                <View className="flex-row items-center mb-1 flex-wrap gap-2">
                  <Badge label={r.action} color={ACTION_COLOR[r.action] ?? 'neutral'} />
                  <Text className="text-xs text-muted">{prettyEntityType(r.entityType)}</Text>
                </View>
                <Text className="text-sm text-text" numberOfLines={2}>
                  {auditSummary(r)}
                </Text>
                <Text className="text-sm text-muted mt-0.5">
                  Changed by {auditActorName(r)} · {formatDate(r.createdAt)}
                </Text>
              </View>
              <Text className="text-primary text-2xl ml-2">
                {expanded === r.id ? '▾' : '›'}
              </Text>
            </TouchableOpacity>

            {expanded === r.id && (
              <View className="mt-3 pt-3 border-t border-border">
                {r.oldValue != null && (
                  <View className="mb-2">
                    <Text className="text-xs font-semibold text-muted mb-1">OLD</Text>
                    <Text className="text-xs text-text bg-surface rounded-md p-2" numberOfLines={6}>
                      {JSON.stringify(r.oldValue, null, 2)}
                    </Text>
                  </View>
                )}
                <View>
                  <Text className="text-xs font-semibold text-muted mb-1">NEW</Text>
                  <Text className="text-xs text-text bg-surface rounded-md p-2" numberOfLines={8}>
                    {JSON.stringify(r.newValue, null, 2)}
                  </Text>
                </View>
                {r.ipAddress ? (
                  <Text className="text-xs text-muted mt-2">IP: {r.ipAddress}</Text>
                ) : null}
              </View>
            )}
          </Card>
        ))}
      </ResponsiveGrid>

      {totalPages > 1 && (
        <View className="flex-row justify-between items-center mt-6 pt-4 border-t border-border">
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
      )}
    </>
  );

  return (
    <SettingsPageLayout
      title="Audit Log"
      subtitle={`${total} total events`}
      refreshing={isFetching}
      onRefresh={refetch}
    >
      {filterBar}
      {content}
    </SettingsPageLayout>
  );
}
