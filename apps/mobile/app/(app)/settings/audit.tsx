/**
 * BuildFlow — Audit Log screen.
 *
 * Owner-only. Searchable, paginated list of all company mutations.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Badge, Button, LoadingSkeleton, EmptyState } from '@/components/ui';
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
  const { data, isLoading, refetch, isFetching } = useAuditLog(page, limit);
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const totalPages = data?.meta.totalPages ?? 1;

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <View className="p-4">
          {[...Array(5)].map((_, i) => (
            <LoadingSkeleton key={i} className="h-20 mb-3" />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-6"
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
      >
        <Text className="text-2xl font-bold text-text pt-4 pb-1">Audit Log</Text>
        <Text className="text-sm text-text-muted mb-4">{total} total events</Text>

        {rows.length === 0 ? (
          <EmptyState title="No activity yet" description="Mutations will appear here." />
        ) : (
          rows.map((r: AuditLogRow) => (
            <Card key={r.id} className="mb-2">
              <TouchableOpacity
                onPress={() => setExpanded(expanded === r.id ? null : r.id)}
                className="flex-row items-center justify-between"
              >
                <View className="flex-1">
                  <View className="flex-row items-center mb-1">
                    <Badge label={r.action} color={ACTION_COLOR[r.action] ?? 'neutral'} />
                    <Text className="text-xs text-text-muted ml-2">{r.entityType}</Text>
                  </View>
                  <Text className="text-sm text-text">
                    {r.userName} · {formatDate(r.createdAt)}
                  </Text>
                  <Text className="text-xs text-text-muted font-mono mt-0.5" numberOfLines={1}>
                    {r.entityId}
                  </Text>
                </View>
                <Text className="text-primary text-2xl">
                  {expanded === r.id ? '▾' : '›'}
                </Text>
              </TouchableOpacity>

              {expanded === r.id && (
                <View className="mt-3 pt-3 border-t border-border">
                  {r.oldValue != null && (
                    <View className="mb-2">
                      <Text className="text-xs font-semibold text-text-muted mb-1">OLD</Text>
                      <Text className="text-xs text-text bg-surface rounded-md p-2" numberOfLines={4}>
                        {JSON.stringify(r.oldValue, null, 2)}
                      </Text>
                    </View>
                  )}
                  <View>
                    <Text className="text-xs font-semibold text-text-muted mb-1">NEW</Text>
                    <Text className="text-xs text-text bg-surface rounded-md p-2" numberOfLines={6}>
                      {JSON.stringify(r.newValue, null, 2)}
                    </Text>
                  </View>
                  {r.ipAddress && (
                    <Text className="text-xs text-text-muted mt-2">IP: {r.ipAddress}</Text>
                  )}
                </View>
              )}
            </Card>
          ))
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <View className="flex-row justify-between mt-4">
            <Button
              label="‹ Prev"
              variant="ghost"
              onPress={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            />
            <Text className="text-sm text-text-muted self-center">
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
      </ScrollView>
    </SafeAreaView>
  );
}