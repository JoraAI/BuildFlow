import React from 'react';
import { View } from 'react-native';

interface ProgressBarProps {
  value: number; // 0-100
  color?: string;
  height?: number;
  className?: string;
}

export function ProgressBar({ value, color = '#1E3A5F', height = 8, className = '' }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <View className={`w-full rounded-full bg-border overflow-hidden ${className}`} style={{ height }}>
      <View
        className="rounded-full"
        style={{ width: `${clamped}%`, height, backgroundColor: color }}
      />
    </View>
  );
}
