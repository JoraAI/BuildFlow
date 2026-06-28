import React from 'react';
import { View, Pressable } from 'react-native';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onPress?: () => void;
}

export function Card({ children, className = '', onPress }: CardProps) {
  const baseClass = `bg-card rounded-xl border border-border p-4 ${onPress ? 'active:opacity-80' : ''} ${className}`;
  if (onPress) {
    return (
      <Pressable onPress={onPress} className={baseClass}>
        {children}
      </Pressable>
    );
  }
  return <View className={baseClass}>{children}</View>;
}
