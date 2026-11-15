/**
 * BuildFlow Platform - company search.
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, SafeAreaView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Input, Button, LoadingSkeleton } from '@/components/ui';
import { FormScreenHeader } from '@/components/layout/ScreenHeader';
import { usePlatformCompanies } from '@/services/platform.queries';

export default function PlatformCompaniesScreen() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const { data, isLoading } = usePlatformCompanies(search);

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <FormScreenHeader title="Companies" cancelLabel="Back" onCancel={() => router.back()} showBack />
      <ScrollView contentContainerClassName="p-6 gap-3 max-w-3xl w-full self-center">
        <View className="flex-row gap-2 mb-2">
          <View className="flex-1">
            <Input label="Search" value={q} onChangeText={setQ} placeholder="Name or GSTIN" />
          </View>
          <Button label="Search" size="sm" onPress={() => setSearch(q)} />
        </View>
        {isLoading ? (
          <LoadingSkeleton className="h-20" />
        ) : (
          data?.map((c: { id: string; name: string; subscriptionPlan: string; subscriptionStatus: string; _count: { users: number } }) => (
            <Pressable key={c.id} onPress={() => router.push(`/platform/companies/${c.id}` as never)}>
              <Card className="mb-0">
                <Text className="font-semibold text-text">{c.name}</Text>
                <Text className="text-xs text-muted">
                  {c.subscriptionPlan} · {c.subscriptionStatus} · {c._count.users} users
                </Text>
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
