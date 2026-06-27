import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Card, Avatar, Button, Badge } from '@/components/ui';
import { useAuthStore } from '@/stores/auth.store';

function SettingRow({ label, value, onPress }: { label: string; value?: string; onPress?: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={!onPress}>
      <View className="flex-row items-center justify-between py-3.5 border-b border-border">
        <Text className="text-base text-text">{label}</Text>
        <View className="flex-row items-center">
          {value && <Text className="text-sm text-text-muted mr-2">{value}</Text>}
          {onPress && <Text className="text-primary text-2xl">›</Text>}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-6">
        <Text className="text-2xl font-bold text-text pt-4 pb-4">Settings</Text>

        <Card className="mb-4">
          <View className="flex-row items-center mb-4">
            <Avatar name={user?.name ?? 'U'} size={56} />
            <View className="ml-3">
              <Text className="text-lg font-bold text-text">{user?.name}</Text>
              <Text className="text-sm text-text-muted">{user?.email}</Text>
              <View className="mt-1">
                <Badge label={user?.role ?? ''} color="primary" />
              </View>
            </View>
          </View>
          <Text className="text-sm text-text-muted">{user?.companyName}</Text>
        </Card>

        <Card className="mb-4">
          <Text className="text-base font-bold text-text mb-2">Company</Text>
          <SettingRow label="Company Profile" onPress={() => router.push('/(app)/settings/company')} />
          <SettingRow label="Users & Roles" onPress={() => router.push('/(app)/settings/users')} />
          <SettingRow label="Resource Library / Material Prices" onPress={() => router.push('/(app)/settings/material-prices')} />
          <SettingRow label="Rate Analysis Library" onPress={() => router.push('/(app)/estimation/rate-analysis')} />
        </Card>

        <Card className="mb-4">
          <Text className="text-base font-bold text-text mb-2">Integrations</Text>
          <SettingRow label="Manage Integrations" onPress={() => router.push('/(app)/settings/integrations')} />
        </Card>

        <Card className="mb-6">
          <Text className="text-base font-bold text-text mb-2">General</Text>
          <SettingRow label="Notifications" onPress={() => router.push('/(app)/notifications')} />
          <SettingRow label="Audit Log" onPress={() => router.push('/(app)/settings/audit')} />
          <SettingRow label="Data Export" onPress={() => router.push('/(app)/settings/export')} />
        </Card>

        <Button label="Sign Out" variant="danger" onPress={logout} fullWidth />

        <Text className="text-center text-xs text-text-muted mt-6">
          BuildFlow v2.0.0 — by Jora AI
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}