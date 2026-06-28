/**
 * BuildFlow Platform - admin dashboard.
 */
import React from 'react';
import { View, Text, ScrollView, SafeAreaView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Button, Badge } from '@/components/ui';
import { usePlatformStore } from '@/stores/platform.store';
import { usePlatformTickets, usePlatformCompanies } from '@/services/platform.queries';

export default function PlatformDashboardScreen() {
  const router = useRouter();
  const admin = usePlatformStore((s) => s.admin);
  const logout = usePlatformStore((s) => s.logout);
  const { data: tickets } = usePlatformTickets();
  const { data: companies } = usePlatformCompanies();

  const openTickets =
    tickets?.filter((t: { status: string }) => !['RESOLVED', 'REJECTED'].includes(t.status)).length ?? 0;

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="px-6 py-4 border-b border-border flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-bold text-text">Platform Admin</Text>
          <Text className="text-sm text-muted">{admin?.email}</Text>
        </View>
        <Button label="Sign out" variant="ghost" size="sm" onPress={logout} />
      </View>
      <ScrollView contentContainerClassName="p-6 gap-4 max-w-4xl w-full self-center">
        <View className="flex-row flex-wrap gap-4">
          <Card className="flex-1 min-w-[200px]">
            <Text className="text-sm text-muted">Companies</Text>
            <Text className="text-3xl font-bold text-text">{companies?.length ?? '-'}</Text>
          </Card>
          <Card className="flex-1 min-w-[200px]">
            <Text className="text-sm text-muted">Open platform tickets</Text>
            <Text className="text-3xl font-bold text-primary">{openTickets}</Text>
          </Card>
        </View>

        <Pressable onPress={() => router.push('/platform/companies' as never)}>
          <Card>
            <Text className="text-lg font-bold text-text mb-1">Companies</Text>
            <Text className="text-sm text-muted">Search tenants, update subscription & legal fields</Text>
          </Card>
        </Pressable>

        <Pressable onPress={() => router.push('/platform/tickets' as never)}>
          <Card>
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-lg font-bold text-text">Escalated tickets</Text>
              {openTickets > 0 ? <Badge label={String(openTickets)} color="warning" /> : null}
            </View>
            <Text className="text-sm text-muted">Review requests escalated from company owners</Text>
          </Card>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
