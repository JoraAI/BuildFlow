import React from 'react';
import { View, Pressable, Platform } from 'react-native';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onPress?: () => void;
}

export function Card({ children, className = '', onPress }: CardProps) {
  // FIX (UI-M11): Add hover state on web for interactive cards so they feel
  // like clickable elements. Also add focus-visible ring for keyboard nav.
  const webHover = Platform.OS === 'web' && onPress ? 'hover:bg-surface hover:border-primary/20 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none transition-colors' : '';
  const baseClass = `bg-card rounded-xl border border-border p-4 ${onPress ? `active:opacity-80 ${webHover}` : ''} ${className}`;
  if (onPress) {
    return (
      <Pressable onPress={onPress} className={baseClass} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
        {children}
      </Pressable>
    );
  }
  return <View className={baseClass}>{children}</View>;
}
