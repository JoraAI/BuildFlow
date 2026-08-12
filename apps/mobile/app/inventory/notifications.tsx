/**
 * Inventory shell - Notification center (INVENTORY_HORIZONTAL_PLATFORM Phase 8.5).
 *
 * In-app notifications from the shared notification infra (low stock, PO-rate
 * anomaly, count variance, etc.). Reuses the shared `/notifications` API.
 */
import React, { useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Badge, EmptyState } from '@/components/ui';
import { useViewport } from '@/hooks/useViewport';
import {
  useNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  type AppNotification,
} from '@/services/chat.queries';

function startOfDay(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function bucketLabel(iso: string): 'Today' | 'Yesterday' | 'Earlier' {
  const now = new Date();
  const item = new Date(iso);
  const diffDays = Math.round((startOfDay(now) - startOfDay(item)) / 86_400_000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return 'Earlier';
}

function deepLink(n: AppNotification): string | null {
  const ref = n.referenceId;
  switch (n.type) {
    // Inventory alert types (Phase 8.5).
    case 'INVENTORY_LOW_STOCK':
      return '/inventory'; // Stock home highlights the item
    case 'INVENTORY_PO_RATE_ANOMALY':
      return '/inventory/procurement';
    case 'INVENTORY_COUNT_VARIANCE':
      return '/inventory/warehouse';
    case 'INVOICE_SENT':
    case 'INVOICE_PAID':
    case 'PAYMENT':
      return ref ? `/inventory/invoices/${ref}` : '/inventory/invoices';
    case 'BILL':
      return ref ? `/inventory/bills/${ref}` : '/inventory/bills';
    default:
      return null;
  }
}

export default function InventoryNotificationsScreen() {
  const { isPhone } = useViewport();
  const router = useRouter();
  const { data, isLoading, isFetching, refetch } = useNotifications();
  const markAll = useMarkAllNotificationsRead();
  const markOne = useMarkNotificationRead();

  const grouped = useMemo(() => {
    const items = data?.notifications ?? [];
    const map = new Map<string, AppNotification[]>();
    for (const n of items) {
      const key = bucketLabel(n.createdAt);
      const arr = map.get(key) ?? [];
      arr.push(n);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [data]);

  if (isLoading) {
    return (
      <View className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      <View className="px-4 pt-4 pb-2 flex-row items-center justify-between">
        <View className="flex-1 mr-2">
          <Text className="text-2xl font-bold text-text">Notifications</Text>
          <Text className="text-sm text-muted mt-0.5">
            Low stock, price anomalies and count variances — no separate product.
          </Text>
        </View>
        {data?.notifications?.length ? (
          <Pressable onPress={() => void markAll.mutate()}>
            <Text className="text-xs font-semibold text-primary">Mark all read</Text>
          </Pressable>
        ) : null}
      </View>

      <FlatList
        className="flex-1"
        data={grouped}
        keyExtractor={([key]) => key}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={() => void refetch()} tintColor="#1E3A5F" />
        }
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        renderItem={({ item: [bucket, items] }) => (
          <View className="mb-4">
            <Text className="text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">{bucket}</Text>
            {items.map((n) => {
              const link = deepLink(n);
              return (
                <Pressable
                  key={n.id}
                  onPress={() => {
                    if (!n.isRead) void markOne.mutate(n.id);
                    if (link) router.push(link as never);
                  }}
                  className={`mb-2 rounded-xl border p-3 ${n.isRead ? 'border-border bg-card' : 'border-primary/40 bg-primary/5'}`}
                >
                  <View className="flex-row items-center gap-2 mb-1">
                    <Text className="text-sm font-semibold text-text flex-1" numberOfLines={1}>
                      {n.title}
                    </Text>
                    {!n.isRead ? <Badge color="primary" label="new" /> : null}
                  </View>
                  <Text className="text-xs text-muted">{n.body}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            title="No notifications"
            description="Low-stock, PO-rate and stock-count alerts will appear here."
          />
        }
      />
    </View>
  );
}
