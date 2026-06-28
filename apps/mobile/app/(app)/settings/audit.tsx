/**
 * BuildFlow - Audit Log screen.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Card, Badge, Button, LoadingSkeleton, EmptyState } from '@/components/ui';
import { SettingsPageLayout } from '@/components/layout/SettingsPageLayout';
import { ResponsiveGrid } from '@/components/layout/ResponsiveGrid';
import { useAuditLog, type AuditLogRow } from '@/services/settings.queries';

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
  const limit = 50;
  const { data, isLoading, isError, refetch, isFetching } = useAuditLog(page, limit);
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const totalPages = data?.meta.totalPages ?? 1;

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
    <EmptyState title="No activity yet" description="Mutations will appear here." />
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
                  <Text className="text-xs text-muted">{r.entityType}</Text>
                </View>
                <Text className="text-sm text-text">
                  {r.userName} · {formatDate(r.createdAt)}
                </Text>
                <Text className="text-xs text-muted font-mono mt-0.5" numberOfLines={1}>
                  {r.entityId}
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
      {content}
    </SettingsPageLayout>
  );
}
