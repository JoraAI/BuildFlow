import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/auth.store';

export function AppMobileHeader() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);

  if (!user) return null;

  const initial = user.name.charAt(0).toUpperCase();

  return (
    <View
      className="bg-primary border-b border-white/10 shrink-0"
      style={{ paddingTop: Math.max(insets.top, 8) }}
    >
      <View className="flex-row items-center justify-between px-4 pb-3 gap-2">
        <Pressable
          onPress={() => router.push('/dashboard')}
          className="flex-row items-center gap-2 active:opacity-80 shrink min-w-0 flex-1"
        >
          <View className="w-8 h-8 rounded-lg bg-accent items-center justify-center shrink-0">
            <Ionicons name="construct" size={18} color="#1E3A5F" />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-white text-sm font-bold">BuildFlow</Text>
            <Text className="text-white/60 text-[11px]" numberOfLines={1}>
              {user.companyName}
            </Text>
          </View>
        </Pressable>

        <View className="flex-row items-center gap-2 shrink-0">
          <Pressable
            onPress={() => router.push('/notifications' as never)}
            className="w-9 h-9 rounded-lg bg-white/10 items-center justify-center active:opacity-80"
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={20} color="#FFFFFF" />
          </Pressable>
          <Pressable
            onPress={() => router.push('/settings' as never)}
            className="w-9 h-9 rounded-full bg-accent/25 border border-accent/40 items-center justify-center active:opacity-80"
            accessibilityLabel="Profile and settings"
          >
            <Text className="text-accent text-sm font-bold">{initial}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
