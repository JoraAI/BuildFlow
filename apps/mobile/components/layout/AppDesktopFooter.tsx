import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';

/** Persistent footer bar on desktop app shell (main content column). */
export function AppDesktopFooter() {
  const router = useRouter();

  return (
    <View className="h-10 shrink-0 border-t border-border bg-card px-6 flex-row items-center justify-between">
      <Text className="text-[11px] text-muted">BuildFlow v2.0 · by Jora AI</Text>
      <View className="flex-row items-center gap-4">
        <Pressable onPress={() => router.push('/settings' as never)}>
          <Text className="text-[11px] text-muted font-medium">Settings</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/notifications' as never)}>
          <Text className="text-[11px] text-muted font-medium">Alerts</Text>
        </Pressable>
      </View>
    </View>
  );
}
