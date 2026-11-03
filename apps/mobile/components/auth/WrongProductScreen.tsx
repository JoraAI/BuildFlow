import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui';
import {
  appDisplayName,
  otherProductAppName,
} from '@/constants/app-variant';
import { useAuthStore } from '@/stores/auth.store';

/** Shown when a user signs into the wrong native Play listing. */
export function WrongProductScreen() {
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const thisApp = appDisplayName();
  const otherApp = otherProductAppName();

  const onSignOut = async () => {
    setBusy(true);
    try {
      await logout();
      router.replace('/login');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="flex-1 bg-surface px-6 justify-center">
      <Text className="text-2xl font-bold text-text mb-2">Wrong app</Text>
      <Text className="text-sm text-muted mb-6">
        This install is <Text className="font-semibold text-text">{thisApp}</Text>, but your
        account belongs to a different product. Install{' '}
        <Text className="font-semibold text-text">{otherApp}</Text> from the store for that
        workspace, or sign out and use a matching account here.
      </Text>
      <Button
        label="Sign out"
        variant="accent"
        onPress={() => void onSignOut()}
        loading={busy}
        fullWidth
      />
    </View>
  );
}
