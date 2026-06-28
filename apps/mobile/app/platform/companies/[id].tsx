/**
 * BuildFlow Platform — company detail & admin actions.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, SafeAreaView, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Card, Input, Button, LoadingSkeleton } from '@/components/ui';
import {
  usePlatformCompany,
  usePlatformUpdateCompany,
  usePlatformUpdateSubscription,
} from '@/services/platform.queries';

export default function PlatformCompanyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const companyId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const { data, isLoading } = usePlatformCompany(companyId ?? '');
  const updateCompany = usePlatformUpdateCompany(companyId ?? '');
  const updateSub = usePlatformUpdateSubscription(companyId ?? '');

  const [name, setName] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [plan, setPlan] = useState('PROFESSIONAL');

  useEffect(() => {
    if (data && typeof data === 'object' && 'name' in data) {
      const c = data as { name: string; subscriptionStatus: string; subscriptionPlan: string };
      setName(c.name);
      setStatus(c.subscriptionStatus);
      setPlan(c.subscriptionPlan);
    }
  }, [data]);

  if (isLoading || !data) {
    return (
      <SafeAreaView className="flex-1 bg-surface p-6">
        <LoadingSkeleton className="h-48" />
      </SafeAreaView>
    );
  }

  const company = data as {
    id: string;
    name: string;
    gstin: string;
    subscriptionPlan: string;
    subscriptionStatus: string;
    trialEndsAt: string | null;
    lastPaymentAt?: string | null;
    users: Array<{ id: string; name: string; email: string; role: string; isActive: boolean }>;
    integrations?: Record<string, { configured: boolean; source: string }>;
  };

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="px-6 py-4 border-b border-border flex-row items-center gap-3">
        <Button label="← Back" variant="ghost" size="sm" onPress={() => router.back()} />
        <Text className="text-xl font-bold text-text flex-1" numberOfLines={1}>
          {company.name}
        </Text>
      </View>
      <ScrollView contentContainerClassName="p-6 gap-4 max-w-3xl w-full self-center">
        <Card>
          <Text className="font-bold text-text mb-3">Company</Text>
          <Input label="Name" value={name} onChangeText={setName} />
          <Text className="text-xs text-muted mt-2">GSTIN: {company.gstin}</Text>
          <Button
            label="Save company"
            size="sm"
            onPress={() =>
              updateCompany.mutate(
                { name },
                {
                  onSuccess: () => Alert.alert('Saved'),
                  onError: (e: Error) => Alert.alert('Error', e.message),
                },
              )
            }
          />
        </Card>

        <Card>
          <Text className="font-bold text-text mb-3">Subscription</Text>
          <Input label="Plan (STARTER/PROFESSIONAL/ENTERPRISE)" value={plan} onChangeText={setPlan} />
          <View className="h-2" />
          <Input label="Status (TRIAL/ACTIVE/EXPIRED/...)" value={status} onChangeText={setStatus} />
          <Text className="text-xs text-muted mt-2">
            Trial ends: {company.trialEndsAt ? new Date(company.trialEndsAt).toLocaleDateString() : '—'}
          </Text>
          <Button
            label="Update subscription"
            size="sm"
            onPress={() =>
              updateSub.mutate(
                { subscriptionPlan: plan, subscriptionStatus: status },
                { onSuccess: () => Alert.alert('Updated'), onError: (e) => Alert.alert('Error', e.message) },
              )
            }
          />
          <Button
            label="Extend trial +14 days"
            variant="secondary"
            size="sm"
            onPress={() => {
              const base = company.trialEndsAt ? new Date(company.trialEndsAt) : new Date();
              base.setDate(base.getDate() + 14);
              updateSub.mutate(
                { subscriptionStatus: 'TRIAL', trialEndsAt: base.toISOString() },
                { onSuccess: () => Alert.alert('Trial extended') },
              );
            }}
          />
        </Card>

        <Card>
          <Text className="font-bold text-text mb-3">Integrations (read-only)</Text>
          {company.integrations ? (
            Object.entries(company.integrations).map(([key, val]) => (
              <View key={key} className="flex-row justify-between py-2 border-b border-border">
                <Text className="text-sm text-text capitalize">{key}</Text>
                <Text className="text-xs text-muted">
                  {val.configured ? val.source : 'none'}
                </Text>
              </View>
            ))
          ) : (
            <Text className="text-xs text-muted">No integration data</Text>
          )}
        </Card>

        <Card>
          <Text className="font-bold text-text mb-3">Users ({company.users.length})</Text>
          {company.users.map((u) => (
            <View key={u.id} className="py-2 border-b border-border">
              <Text className="text-sm font-medium text-text">{u.name}</Text>
              <Text className="text-xs text-muted">
                {u.email} · {u.role} · {u.isActive ? 'Active' : 'Inactive'}
              </Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
