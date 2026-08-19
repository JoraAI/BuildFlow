import React, { useState } from 'react';
import { Pressable, View, Platform } from 'react-native';
import { usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAssistantStore } from '@/stores/assistant.store';
import { getProjectIdFromPath } from '@/constants/navigation';

/**
 * Logged-in assistant launcher (Construction dashboard + Inventory).
 * Slim curved pull-tab on the right edge so it never covers the bottom nav.
 * Public / not-logged-in chat stays a circular FAB (`MarketingAssistantFab`).
 */
export function AssistantFab() {
  const pathname = usePathname();
  const isOpen = useAssistantStore((s) => s.isOpen);
  const open = useAssistantStore((s) => s.open);
  const [hovered, setHovered] = useState(false);
  const projectId = getProjectIdFromPath(pathname) ?? undefined;

  if (isOpen || pathname.startsWith('/login')) return null;

  return (
    <Pressable
      onPress={() => open(projectId)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="button"
      accessibilityLabel="Open BuildFlow Assistant"
      hitSlop={{ top: 8, bottom: 8, left: 12, right: 0 }}
      style={({ pressed }) => ({
        position: 'absolute',
        right: 0,
        top: '38%',
        zIndex: 80,
        width: 28,
        height: 88,
        borderTopLeftRadius: 22,
        borderBottomLeftRadius: 22,
        backgroundColor: '#1E3A5F',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderRightWidth: 0,
        borderColor: 'rgba(245, 158, 11, 0.55)',
        opacity: pressed || hovered ? 1 : 0.5,
        ...Platform.select({
          web: { boxShadow: '-4px 4px 16px rgba(15, 23, 42, 0.22)', cursor: 'pointer' },
          default: {
            elevation: 8,
            shadowColor: '#0F172A',
            shadowOffset: { width: -2, height: 2 },
            shadowOpacity: 0.22,
            shadowRadius: 8,
          },
        }),
      })}
    >
      <View style={{ alignItems: 'center', gap: 6 }}>
        <View
          style={{
            width: 3,
            height: 16,
            borderRadius: 2,
            backgroundColor: 'rgba(245, 158, 11, 0.9)',
          }}
        />
        <Ionicons name="chatbubble-ellipses" size={16} color="#F59E0B" />
      </View>
    </Pressable>
  );
}
