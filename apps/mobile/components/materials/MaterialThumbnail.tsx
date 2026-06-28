import React from 'react';
import { View, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Resource } from '@/services/estimate.queries';

type CategoryVisual = {
  icon: keyof typeof Ionicons.glyphMap;
  bg: string;
  tint: string;
};

const CATEGORY_VISUAL: Record<string, CategoryVisual> = {
  Cement: { icon: 'cube-outline', bg: '#F1F5F9', tint: '#475569' },
  Steel: { icon: 'git-commit-outline', bg: '#E0E7FF', tint: '#1E3A5F' },
  Aggregates: { icon: 'layers-outline', bg: '#FEF3C7', tint: '#B45309' },
  Bricks: { icon: 'grid-outline', bg: '#FEE2E2', tint: '#B91C1C' },
};

const DEFAULT_VISUAL: CategoryVisual = {
  icon: 'construct-outline',
  bg: '#ECFDF5',
  tint: '#047857',
};

export function categoryVisual(category: string | null | undefined): CategoryVisual {
  if (!category) return DEFAULT_VISUAL;
  return CATEGORY_VISUAL[category] ?? DEFAULT_VISUAL;
}

export function MaterialThumbnail({
  material,
  size = 52,
  localUri,
}: {
  material?: Pick<Resource, 'category' | 'imageUrl'>;
  size?: number;
  /** Local file URI before upload (add/edit form preview). */
  localUri?: string | null;
}) {
  const visual = categoryVisual(material?.category ?? null);
  const uri = localUri ?? material?.imageUrl;

  if (uri) {
    return (
      <Image
        source={{ uri }}
        className="rounded-xl bg-border border border-border/60"
        style={{ width: size, height: size }}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      className="rounded-xl items-center justify-center border border-border/40"
      style={{ width: size, height: size, backgroundColor: visual.bg }}
    >
      <Ionicons name={visual.icon} size={size * 0.42} color={visual.tint} />
    </View>
  );
}
