/**
 * Inventory user activity — company audit trail (Settings audit API).
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { Card, Badge, Button, LoadingSkeleton, EmptyState } from '@/components/ui';
import { useAuditLog, type AuditLogRow } from '@/services/settings.queries';
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
  const limit = 40;
  const { data, isLoading, isError, refetch, isFetching } = useAuditLog(page, limit);
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const totalPages = data?.meta.totalPages ?? 1;

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
        <EmptyState title="No activity yet" description="Stock, sales, and settings changes will appear here." />
      ) : (
        <View className="gap-2">
          {rows.map((r: AuditLogRow) => (
            <Card key={r.id} className="p-3">
              <TouchableOpacity onPress={() => setExpanded(expanded === r.id ? null : r.id)}>
                <View className="flex-row items-center justify-between gap-2">
                  <View className="flex-1 min-w-0">
                    <View className="flex-row items-center flex-wrap gap-2 mb-1">
                      <Badge label={r.action} color={ACTION_COLOR[r.action] ?? 'neutral'} />
                      <Text className="text-xs text-muted">{r.entityType}</Text>
                    </View>
                    <Text className="text-sm text-text">
                      {r.userName} · {formatDate(r.createdAt)}
                    </Text>
                  </View>
                  <Text className="text-primary text-xl">{expanded === r.id ? '▾' : '›'}</Text>
                </View>
              </TouchableOpacity>
              {expanded === r.id ? (
                <View className="mt-3 pt-3 border-t border-border">
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
          ))}
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
