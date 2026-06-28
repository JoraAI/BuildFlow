import React from 'react';
import { View, Text, Image } from 'react-native';
import { getInitials } from '@/utils/format';

interface AvatarProps {
  name: string;
  size?: number;
  imageUrl?: string | null;
}

export function Avatar({ name, size = 40, imageUrl }: AvatarProps) {
  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        className="rounded-full bg-border"
        style={{ width: size, height: size }}
      />
    );
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

interface CompanyLogoProps {
  name: string;
  logoUrl?: string | null;
  size?: number;
}

export function CompanyLogo({ name, logoUrl, size = 40 }: CompanyLogoProps) {
  if (logoUrl) {
    return (
      <Image
        source={{ uri: logoUrl }}
        className="rounded-lg bg-border"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <View
      className="rounded-lg bg-primary/10 border border-primary/20 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <Text className="text-primary font-bold" style={{ fontSize: size * 0.35 }}>
        {getInitials(name).slice(0, 2)}
      </Text>
    </View>
  );
}
