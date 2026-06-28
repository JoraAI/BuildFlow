import React from 'react';
import { Pressable, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useViewport } from '@/hooks/useViewport';
import { fabLeft, screenFabBottom } from '@/components/layout/fab-layout';

interface FABProps {
  /** Text beside the icon. Omit or pass "+" for a compact icon-only button. */
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
}

export function FAB({ label, icon = 'add', onPress }: FABProps) {
  const insets = useSafeAreaInsets();
  const { isDesktop } = useViewport();
  const iconOnly = !label || label === '+';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={`absolute flex-row items-center justify-center rounded-full bg-accent shadow-lg active:bg-accent-dark z-40 ${
        iconOnly ? 'w-14 h-14' : 'px-4 py-3.5'
      }`}
      style={{
        bottom: screenFabBottom(insets.bottom, isDesktop),
        left: fabLeft(),
        elevation: 5,
      }}
    >
      <Ionicons name={icon} size={iconOnly ? 26 : 22} color="#fff" />
      {!iconOnly && <Text className="text-white font-semibold ml-2">{label}</Text>}
    </Pressable>
  );
}
