/**
 * Notification center - grouped by Today / Yesterday / Earlier.
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { FormScreenHeader } from '@/components/layout/ScreenHeader';
import { dismissTo, DISMISS } from '@/utils/navigation';
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
    case 'TASK_OVERDUE':
    case 'TASK':
      return ref ? `/(app)/planning` : null;
    case 'INVOICE_SENT':
    case 'INVOICE_PAID':
    case 'PAYMENT':
      return ref ? `/(app)/accounting/invoice/${ref}` : '/(app)/accounting';
    case 'BILL':
      return '/(app)/accounting';
    case 'DAILY_REPORT':
      return ref ? `/(app)/reports/${ref}` : '/(app)/reports';
    case 'ESTIMATE_APPROVED':
    case 'ESTIMATE_REJECTED':
    case 'ESTIMATE':
      return ref ? `/(app)/estimation/${ref}` : '/(app)/proposals';
    case 'BUDGET':
    case 'MATERIAL_PRICE':
    case 'MATERIAL_RATE_VARIANCE':
      return '/(app)/dashboard';
    case 'TRIAL_ENDING':
    case 'TRIAL_EXPIRED':
      return '/(app)/settings/billing';
    default:
      return null;
  }
}

export default function NotificationsScreen() {
  const { data, isLoading, refetch, isFetching } = useNotifications(false);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const items = data?.items ?? [];

  const grouped = useMemo(() => {
    const map: Record<string, AppNotification[]> = { Today: [], Yesterday: [], Earlier: [] };
    for (const n of items) map[bucketLabel(n.createdAt)].push(n);
    return map;
  }, [items]);

  const ordered: Array<{ key: string; data: AppNotification[] }> = [
    { key: 'Today', data: grouped.Today },
    { key: 'Yesterday', data: grouped.Yesterday },
    { key: 'Earlier', data: grouped.Earlier },
  ].filter((g) => g.data.length > 0);

  const handlePress = (n: AppNotification) => {
    if (!n.isRead) markRead.mutate(n.id);
    const link = deepLink(n);
    if (link) router.push(link as never);
  };

  const subtitle = data?.unreadCount
    ? `${data.unreadCount} unread`
    : 'All caught up';

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['bottom']}>
      <FormScreenHeader
        title="Notifications"
        subtitle={subtitle}
        onCancel={() => dismissTo(DISMISS.notifications)}
        cancelLabel="Back"
        right={
          data?.unreadCount ? (
            <Pressable
              onPress={() => markAll.mutate()}
              disabled={markAll.isPending}
              className="px-3 py-1.5 rounded-lg bg-primary/10 active:opacity-80"
            >
              <Text className="text-xs font-semibold text-primary">
                {markAll.isPending ? 'Marking…' : 'Mark all read'}
              </Text>
            </Pressable>
          ) : undefined
        }
      />

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#1E3A5F" />
        </View>
      ) : ordered.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-base font-bold text-text mb-2">No notifications</Text>
          <Text className="text-sm text-muted text-center">
            Alerts about tasks, bills, and estimates will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={ordered}
          keyExtractor={(g) => g.key}
          renderItem={({ item: group }) => (
            <View className="px-4 pt-4">
              <Text className="text-[11px] font-bold text-muted uppercase tracking-wider mb-2">
                {group.key}
              </Text>
              {group.data.map((n) => (
                <Pressable
                  key={n.id}
                  onPress={() => handlePress(n)}
                  className={`flex-row rounded-xl mb-2 border px-3.5 py-3.5 ${
                    n.isRead ? 'bg-card border-border' : 'bg-accent/5 border-accent'
                  }`}
                >
                  {!n.isRead && (
                    <View className="w-1 rounded-full bg-accent mr-3 self-stretch" />
                  )}
                  <View className="flex-1">
                    <Text className="text-[15px] font-semibold text-text mb-0.5">{n.title}</Text>
                    <Text className="text-[13px] text-muted leading-[18px]">{n.body}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
          refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </SafeAreaView>
  );
}
