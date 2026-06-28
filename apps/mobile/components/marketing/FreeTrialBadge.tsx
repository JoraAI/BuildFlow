import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type FreeTrialBadgeProps = {
  /** Inline pill for cards and nav */
  compact?: boolean;
  /** Light text for dark hero backgrounds */
  onDark?: boolean;
  className?: string;
};

export function FreeTrialBadge({ compact = false, onDark = false, className = '' }: FreeTrialBadgeProps) {
  if (compact) {
    return (
      <View
        className={`flex-row items-center gap-1.5 px-2.5 py-1 rounded-full border ${
          onDark ? 'bg-white/15 border-white/25' : 'bg-accent/15 border-accent/35'
        } ${className}`}
      >
        <Ionicons name="sparkles" size={12} color={onDark ? '#F59E0B' : '#B45309'} />
        <Text className={`text-xs font-bold ${onDark ? 'text-white' : 'text-primary'}`}>14 days free</Text>
      </View>
    );
  }

  return (
    <View
      className={`flex-row items-center gap-3 px-4 py-3.5 rounded-xl border ${
        onDark ? 'bg-white/10 border-white/20' : 'bg-accent/10 border-accent/25'
      } ${className}`}
    >
      <View
        className={`w-11 h-11 rounded-full items-center justify-center ${
          onDark ? 'bg-accent' : 'bg-accent/25'
        }`}
      >
        <Ionicons name="time-outline" size={22} color={onDark ? '#1E3A5F' : '#B45309'} />
      </View>
      <View className="flex-1">
        <Text className={`text-base font-bold ${onDark ? 'text-white' : 'text-text'}`}>
          14-day free trial
        </Text>
        <Text className={`text-sm mt-0.5 ${onDark ? 'text-white/70' : 'text-muted'}`}>
          Full access · No credit card required
        </Text>
      </View>
      <Ionicons name="checkmark-circle" size={22} color="#10B981" />
    </View>
  );
}
