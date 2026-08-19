import React, { useState } from 'react';
import { Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/** Right-edge pull-tab: chat icon only, 50% opacity until hover/press. */
export function AssistantEdgeHandle({
  onPress,
  accessibilityLabel,
}: {
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={{ top: 10, bottom: 10, left: 14, right: 0 }}
      style={({ pressed }) => ({
        position: 'absolute',
        right: 0,
        top: '38%',
        zIndex: 80,
        width: 36,
        height: 56,
        borderTopLeftRadius: 16,
        borderBottomLeftRadius: 16,
        backgroundColor: '#1E3A5F',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderRightWidth: 0,
        borderColor: 'rgba(245, 158, 11, 0.45)',
        opacity: pressed || hovered ? 1 : 0.5,
        ...Platform.select({
          web: { boxShadow: '-4px 4px 16px rgba(15, 23, 42, 0.2)', cursor: 'pointer' },
          default: {
            elevation: 8,
            shadowColor: '#0F172A',
            shadowOffset: { width: -2, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
          },
        }),
      })}
    >
      <Ionicons name="chatbubble-ellipses" size={20} color="#F59E0B" />
    </Pressable>
  );
}
