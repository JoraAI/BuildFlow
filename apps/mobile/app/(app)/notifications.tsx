/**
 * Notification center — grouped by Today / Yesterday / Earlier.
 * Unread items have a left accent bar; tap marks read + deep-links.
 */
import React, { useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
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
      return ref ? `/(app)/estimation/${ref}` : '/(app)/estimation';
    case 'BUDGET':
    case 'MATERIAL_PRICE':
      return '/(app)/dashboard';
    default:
      return null;
  }
}

export default function NotificationsScreen() {
  const { data, isLoading, refetch, isFetching } = useNotifications(false);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const items = data?.items ?? [];

  // Group into ordered buckets preserving recency
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
    if (link) router.push(link as any);
  };

  const renderItem = ({ item }: { item: AppNotification }) => (
    <TouchableOpacity
      style={[styles.card, !item.isRead && styles.cardUnread]}
      onPress={() => handlePress(item)}
      activeOpacity={0.7}
    >
      {!item.isRead && <View style={styles.accentBar} />}
      <View style={styles.cardBody}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.body}>{item.body}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header actions */}
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>
          {data?.unreadCount ? `${data.unreadCount} unread` : 'All caught up'}
        </Text>
        {data?.unreadCount ? (
          <TouchableOpacity
            onPress={() => markAll.mutate()}
            disabled={markAll.isPending}
            style={styles.markAllBtn}
          >
            <Text style={styles.markAllText}>
              {markAll.isPending ? 'Marking…' : 'Mark all read'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1E3A5F" />
        </View>
      ) : ordered.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No notifications</Text>
          <Text style={styles.emptyBody}>Alerts about tasks, bills, and estimates will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={ordered}
          keyExtractor={(g) => g.key}
          renderItem={({ item: group }) => (
            <View style={styles.group}>
              <Text style={styles.groupHeader}>{group.key}</Text>
              {group.data.map((n) => (
                <View key={n.id}>{renderItem({ item: n })}</View>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1E3A5F', marginBottom: 6 },
  emptyBody: { fontSize: 14, color: '#64748B', textAlign: 'center' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  headerTitle: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  markAllBtn: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#E0E7EF', borderRadius: 8 },
  markAllText: { fontSize: 12, fontWeight: '600', color: '#1E3A5F' },
  group: { paddingHorizontal: 16, paddingTop: 16 },
  groupHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 8,
    paddingVertical: 14,
    paddingRight: 14,
    paddingLeft: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardUnread: { borderColor: '#F59E0B', backgroundColor: '#FFFBEB' },
  accentBar: { width: 4, borderRadius: 4, backgroundColor: '#F59E0B', marginRight: 12, alignSelf: 'stretch' },
  cardBody: { flex: 1 },
  title: { fontSize: 15, fontWeight: '600', color: '#0F172A', marginBottom: 2 },
  body: { fontSize: 13, color: '#475569', lineHeight: 18 },
});