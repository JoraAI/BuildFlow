/**
 * Inventory — My account (login email & mobile).
 */
import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { LoadingSkeleton } from '@/components/ui';
import { ProfileContactForm } from '@/components/settings/ProfileContactForm';
import { useMyProfile } from '@/services/settings.queries';
import { inventoryPageListPadding } from '@/components/inventory/InventoryScreenList';
import { useViewport } from '@/hooks/useViewport';

export default function InventoryProfileScreen() {
  const router = useRouter();
  const { isPhone } = useViewport();
  const { data, isLoading } = useMyProfile();

  return (
    <View className="flex-1 bg-surface">
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
        <Pressable onPress={() => router.back()} hitSlop={8} className="mb-2 self-start">
          <Text className="text-sm font-semibold text-primary">‹ Back</Text>
        </Pressable>
        <Text className={`font-bold text-text mb-1 ${isPhone ? 'text-xl' : 'text-2xl'}`}>
          My account
        </Text>
        <Text className="text-sm text-muted mb-4">
          Update the email or mobile you use to sign in. Changes need a one-time code.
        </Text>
        {isLoading || !data ? (
          <LoadingSkeleton className="h-48" />
        ) : (
          <ProfileContactForm profile={data} />
        )}
      </ScrollView>
    </View>
  );
}
