import React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useViewport } from '@/hooks/useViewport';
import { useAssistantStore } from '@/stores/assistant.store';
import { getProjectIdFromPath } from '@/constants/navigation';
import { assistantFabBottom, fabRight } from '@/components/layout/fab-layout';

/** Floating assistant launcher - compact icon-only FAB, bottom-right on mobile & desktop. */
export function AssistantFab() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useViewport();
  const isOpen = useAssistantStore((s) => s.isOpen);
  const open = useAssistantStore((s) => s.open);

  const projectId = getProjectIdFromPath(pathname) ?? undefined;

  if (isOpen || pathname.startsWith('/login')) return null;

  const bottom = assistantFabBottom(insets.bottom, isDesktop);

  return (
    <Pressable
      onPress={() => open(projectId)}
      accessibilityRole="button"
      accessibilityLabel="Open BuildFlow Assistant"
      className="absolute z-50 w-14 h-14 items-center justify-center rounded-full bg-primary shadow-lg active:opacity-90 border border-white/10"
      style={{
        bottom,
        right: fabRight(isDesktop),
        elevation: 8,
      }}
    >
      <View className="w-10 h-10 rounded-full bg-accent items-center justify-center">
        <Ionicons name="chatbubble-ellipses" size={22} color="#1E3A5F" />
      </View>
    </Pressable>
  );
}
