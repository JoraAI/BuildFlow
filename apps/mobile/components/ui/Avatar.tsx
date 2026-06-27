import React from 'react';
import { View, Text } from 'react-native';
import { getInitials } from '@/utils/format';

interface AvatarProps {
  name: string;
  size?: number;
  imageUrl?: string | null;
}

export function Avatar({ name, size = 40, imageUrl }: AvatarProps) {
  if (imageUrl) {
    // Image avatar omitted for Phase 1 simplicity; initials fallback used.
  }
  return (
    <View
      className="rounded-full bg-primary items-center justify-center"
      style={{ width: size, height: size }}
    >
      <Text className="text-white font-bold" style={{ fontSize: size * 0.4 }}>
        {getInitials(name)}
      </Text>
    </View>
  );
}
