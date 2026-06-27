import React from 'react';
import { View, Text } from 'react-native';

type BadgeColor = 'success' | 'warning' | 'danger' | 'primary' | 'accent' | 'neutral';

interface BadgeProps {
  label: string;
  color?: BadgeColor;
}

const colorMap: Record<BadgeColor, string> = {
  success: 'bg-success/15',
  warning: 'bg-warning/15',
  danger: 'bg-danger/15',
  primary: 'bg-primary/10',
  accent: 'bg-accent/15',
  neutral: 'bg-border',
};

const textColorMap: Record<BadgeColor, string> = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  primary: 'text-primary',
  accent: 'text-accent-dark',
  neutral: 'text-text-muted',
};

export function Badge({ label, color = 'neutral' }: BadgeProps) {
  return (
    <View className={`rounded-full px-2.5 py-1 ${colorMap[color]}`}>
      <Text className={`text-xs font-semibold ${textColorMap[color]}`}>{label}</Text>
    </View>
  );
}
