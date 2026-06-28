/**
 * BuildFlow — My Profile (self-service name + phone).
 */
import React, { useState, useEffect } from 'react';
import { View, Text, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Input, Button, LoadingSkeleton, Badge } from '@/components/ui';
import { Avatar, CompanyLogo } from '@/components/ui/Avatar';
import { SettingsPageLayout } from '@/components/layout/SettingsPageLayout';
import { useMyProfile, useUpdateMyProfile } from '@/services/settings.queries';
import { useAuthStore } from '@/stores/auth.store';

export default function MyProfileScreen() {
  const router = useRouter();
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const { data, isLoading } = useMyProfile();
  const update = useUpdateMyProfile();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (data) {
      setName(data.name);
      setPhone(data.phone ?? '');
    }
  }, [data]);

  const onSave = () => {
    update.mutate(
      { name: name.trim(), phone: phone.trim() || null },
      {
        onSuccess: async () => {
          await refreshUser();
          Alert.alert('Saved', 'Profile updated.');
        },
        onError: (e: Error) => Alert.alert('Error', e.message),
      },
    );
  };

  const content = isLoading || !data ? (
    <LoadingSkeleton className="h-48" />
  ) : (
    <>
      <Card className="mb-4">
        <View className="flex-row items-center gap-4 mb-4">
          <CompanyLogo name={data.companyName} logoUrl={data.companyLogoUrl} size={56} />
          <View className="flex-1">
            <Text className="text-sm font-semibold text-text">{data.companyName}</Text>
            <Text className="text-xs text-muted">Company</Text>
          </View>
          <Avatar name={data.name} size={48} imageUrl={null} />
        </View>
        <Input label="Full name" value={name} onChangeText={setName} />
        <View className="h-4" />
        <Input
          label="Phone"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="+91..."
        />
        <View className="h-4" />
        <Text className="text-sm font-medium text-text mb-1">Email</Text>
        <Text className="text-base text-muted mb-1">{data.email}</Text>
        <Text className="text-xs text-muted mb-2">Contact owner to change email</Text>
        <View className="mt-2">
          <Badge label={data.role} color="primary" />
        </View>
      </Card>
      <Button
        label={update.isPending ? 'Saving...' : 'Save changes'}
        onPress={onSave}
        disabled={update.isPending}
        fullWidth
      />
      <Button
        label="Request a change (role / email)"
        variant="secondary"
        onPress={() => router.push('/(app)/settings/tickets/create?category=PROFILE_CHANGE' as never)}
        fullWidth
      />
    </>
  );

  return (
    <SettingsPageLayout title="My Profile" subtitle="Your personal details">
      {content}
    </SettingsPageLayout>
  );
}
