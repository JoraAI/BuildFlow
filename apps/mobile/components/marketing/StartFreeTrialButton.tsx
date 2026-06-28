import React from 'react';
import { Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui';

type StartFreeTrialButtonProps = {
  onPress: () => void;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
};

/** Primary marketing CTA - high-contrast amber button. */
export function StartFreeTrialButton({
  onPress,
  fullWidth = false,
  size = 'lg',
  label = 'Start free trial',
}: StartFreeTrialButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center justify-center rounded-xl bg-accent active:opacity-95 ${
        size === 'lg' ? 'px-7 py-4' : size === 'md' ? 'px-5 py-3' : 'px-4 py-2.5'
      } ${fullWidth ? 'w-full' : ''}`}
    >
      <Ionicons name="sparkles" size={size === 'lg' ? 20 : 16} color="#1E3A5F" />
      <Text
        className={`font-bold text-primary ml-2 ${
          size === 'lg' ? 'text-lg' : size === 'md' ? 'text-base' : 'text-sm'
        }`}
      >
        {label}
      </Text>
      <Ionicons
        name="arrow-forward"
        size={size === 'lg' ? 20 : 16}
        color="#1E3A5F"
        style={{ marginLeft: 8 }}
      />
    </Pressable>
  );
}

/** Compact accent button for pricing cards (uses shared Button accent variant). */
export function StartFreeTrialCardButton({
  onPress,
  highlighted = false,
}: {
  onPress: () => void;
  highlighted?: boolean;
}) {
  if (highlighted) {
    return <StartFreeTrialButton onPress={onPress} fullWidth size="md" />;
  }
  return (
    <Button label="Start free trial" variant="accent" size="sm" fullWidth onPress={onPress} />
  );
}
