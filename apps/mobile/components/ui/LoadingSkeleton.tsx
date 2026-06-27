import React from 'react';
import { View } from 'react-native';

export function LoadingSkeleton({ className = '' }: { className?: string }) {
  return <View className={`rounded-md bg-border animate-pulse ${className}`} />;
}
