/**
 * Inventory — My account (login email & mobile).
 */
import React from 'react';
import { View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { LoadingSkeleton } from '@/components/ui';
import { ProfileContactForm } from '@/components/settings/ProfileContactForm';
import { useMyProfile } from '@/services/settings.queries';
import { inventoryPageListPadding } from '@/components/inventory/InventoryScreenList';
import { FormScreenHeader } from '@/components/layout/ScreenHeader';

export default function InventoryProfileScreen() {
  const router = useRouter();
  const { data, isLoading } = useMyProfile();

  return (
    <View className="flex-1 bg-surface">
      <FormScreenHeader
        title="My account"
        subtitle="Update the email or mobile you use to sign in. Changes need a one-time code."
        cancelLabel="Back"
        onCancel={() => router.back()}
        showBack
      />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: 16,
          paddingBottom: inventoryPageListPadding() + 16,
          width: '100%',
          alignSelf: 'center',
          maxWidth: 720,
        }}
      >
        {isLoading || !data ? (
          <LoadingSkeleton className="h-48" />
        ) : (
          <ProfileContactForm profile={data} />
        )}
      </ScrollView>
    </View>
  );
}
