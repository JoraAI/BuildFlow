import React from 'react';
import { Pressable, View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useViewport } from '@/hooks/useViewport';
import { useAssistantStore } from '@/stores/assistant.store';
import { getProjectIdFromPath } from '@/constants/navigation';
import { assistantFabBottom, fabRight } from '@/components/layout/fab-layout';

/**
 * Assistant launcher.
 * Phone/tablet: slim curved pull-tab on the right edge (does not cover the bottom nav).
 * Desktop: compact FAB in the bottom-right corner.
 */
export function AssistantFab() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useViewport();
  const isOpen = useAssistantStore((s) => s.isOpen);
  const open = useAssistantStore((s) => s.open);

  const projectId = getProjectIdFromPath(pathname) ?? undefined;

  if (isOpen || pathname.startsWith('/login')) return null;

  if (!isDesktop) {
    return (
      <Pressable
        onPress={() => open(projectId)}
        accessibilityRole="button"
        accessibilityLabel="Open BuildFlow Assistant"
        hitSlop={{ top: 8, bottom: 8, left: 12, right: 0 }}
        style={{
          position: 'absolute',
          right: 0,
          top: '38%',
          zIndex: 50,
          width: 28,
          height: 88,
          borderTopLeftRadius: 22,
          borderBottomLeftRadius: 22,
          backgroundColor: '#1E3A5F',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderRightWidth: 0,
          borderColor: 'rgba(245, 158, 11, 0.5)',
          ...Platform.select({
            web: { boxShadow: '-4px 4px 16px rgba(15, 23, 42, 0.22)' },
            default: {
              elevation: 8,
              shadowColor: '#0F172A',
              shadowOffset: { width: -2, height: 2 },
              shadowOpacity: 0.22,
              shadowRadius: 8,
            },
          }),
        }}
      >
        <View style={{ alignItems: 'center', gap: 6 }}>
          <View
            style={{
              width: 3,
              height: 16,
              borderRadius: 2,
              backgroundColor: 'rgba(245, 158, 11, 0.85)',
            }}
          />
          <Ionicons name="chatbubble-ellipses" size={16} color="#F59E0B" />
        </View>
      </Pressable>
    );
  }

  const bottom = assistantFabBottom(insets.bottom, true);

  return (
    <Pressable
      onPress={() => open(projectId)}
      accessibilityRole="button"
      accessibilityLabel="Open BuildFlow Assistant"
      className="absolute z-50 w-14 h-14 items-center justify-center rounded-full bg-primary shadow-lg active:opacity-90 border border-white/10"
      style={{
        bottom,
        right: fabRight(true),
        elevation: 8,
      }}
    >
      <View className="w-10 h-10 rounded-full bg-accent items-center justify-center">
        <Ionicons name="chatbubble-ellipses" size={22} color="#1E3A5F" />
      </View>
    </Pressable>
  );
}
