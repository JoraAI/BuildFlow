/**
 * BuildFlow Platform — escalated ticket queue.
 */
import React from 'react';
import { View, Text, ScrollView, SafeAreaView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Badge, Button, LoadingSkeleton, EmptyState } from '@/components/ui';
import { usePlatformTickets, usePlatformUpdateTicket } from '@/services/platform.queries';

export default function PlatformTicketsScreen() {
  const router = useRouter();
  const { data, isLoading } = usePlatformTickets();
  const update = usePlatformUpdateTicket();

  const resolve = (ticketId: string, status: 'RESOLVED' | 'REJECTED') => {
    update.mutate(
      {
        ticketId,
        data: {
          status,
          resolutionNote:
            status === 'RESOLVED'
              ? 'Resolved by BuildFlow support'
              : 'Unable to fulfill — contact owner',
        },
      },
      { onError: (e) => Alert.alert('Error', e.message) },
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="px-6 py-4 border-b border-border flex-row items-center gap-3">
        <Button label="← Back" variant="ghost" size="sm" onPress={() => router.back()} />
        <Text className="text-xl font-bold text-text flex-1">Platform tickets</Text>
      </View>
      <ScrollView contentContainerClassName="p-6 gap-3 max-w-3xl w-full self-center">
        {isLoading ? (
          <LoadingSkeleton className="h-24" />
        ) : !data?.length ? (
          <EmptyState title="No escalated tickets" description="Company escalations appear here." />
        ) : (
          data.map((t: import('@/services/settings.queries').SupportTicketRow & { companyName: string }) => (
            <Card key={t.id}>
              <View className="flex-row justify-between mb-2">
                <Text className="font-semibold text-text flex-1 mr-2">{t.subject}</Text>
                <Badge label={t.status} color="warning" />
              </View>
              <Text className="text-xs text-muted mb-1">
                {t.companyName} · {t.requesterName} · {t.category}
              </Text>
              <Text className="text-sm text-text-muted">{t.description}</Text>
              {!['RESOLVED', 'REJECTED'].includes(t.status) ? (
                <View className="flex-row gap-2 mt-3 pt-3 border-t border-border">
                  <Button label="Resolve" size="sm" onPress={() => resolve(t.id, 'RESOLVED')} />
                  <Button label="Reject" size="sm" variant="secondary" onPress={() => resolve(t.id, 'REJECTED')} />
                </View>
              ) : null}
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
